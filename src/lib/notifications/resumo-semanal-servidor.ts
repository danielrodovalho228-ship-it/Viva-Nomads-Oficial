import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/site";
import { totalMesDaLinha } from "@/lib/precos";
import { situacaoLimite } from "@/lib/limites";
import { notify } from "@/lib/notifications";
import { primeiroNome } from "@/lib/display-name";
import { getProperty } from "@/lib/data/properties";
import { paresCompat } from "@/lib/data/pedidos-compat";
import { imovelBateComBusca } from "@/lib/busca/alerta-busca";
import { precoDeBusca } from "@/lib/busca/painel-filtros";
import type { Property } from "@/lib/types";
import { recebeAvisoComum } from "./preferencias";
import { enviosRecentes } from "./proativos-servidor";
import { CATEGORIA_PROATIVOS, diaBrasilia, podeEnviarProativo, urlsDescadastro } from "./proativos";
import { montarEmailResumoSemanal } from "./email-resumo-semanal";
import type { ImovelDoCartao } from "./cartoes-email";
import {
  chaveResumo,
  EVENTO_RESUMO,
  fatosDaBusca,
  inicioDaJanela,
  motivoDaBusca,
  motivoDaQueda,
  motivoDoPedido,
  origemDoResumo,
  selecionarResumo,
  temNovidade,
  type CandidatoNovo,
  type CandidatoQueda,
} from "./resumo-semanal";

/*
  E375-B — RESUMO SEMANAL de recomendações (SERVER-ONLY). Quem chama: o disparo diário /api/cron/resumo-pedidos (só
  às terças de Brasília, com RESUMO_SEMANAL_ATIVO ligada) e o botão "Gerar resumo semanal agora" de Admin → Dados de
  teste (só contas is_teste). A regra pura (seleção, motivo, assunto) está em resumo-semanal.ts.
    • Destinatários: morador com pedido ATIVO ou busca salva com ALERTA ligado (nunca pela navegação).
    • Novos: anúncios publicados nos últimos 7 dias (properties.publicado_em, 0275) que combinam pela MESMA regra do
      aviso (compatibilidade_pedidos para o pedido; imovelBateComBusca para a busca), mais os pendentes da fila dos
      proativos (E264-B) cujo anúncio ainda está no ar — esses saem aqui, marcados com o envio_id do resumo.
    • Baixou o valor: favoritos com queda do total por mês nos últimos 7 dias (quedas_preco, 0275).
    • Sem repetição: o anúncio que já saiu em qualquer proativo não volta como novo; a mesma queda nunca sai duas vezes.
    • É um proativo: teto (1 por dia, 3 em 7) e silêncio; as linhas são reservadas ANTES do envio (envio_id) e voltam
      se o e-mail não sair. Sem novidade, nada sai.
*/

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
type LinhaImovel = {
  id: string;
  title: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  status: string;
  owner_id: string;
  monthly_price: number | null;
  condo_fee: number | null;
  utilities_mode: string | null;
  utilities_estimate: number | null;
  area_m2: number | null;
  bedrooms: number | null;
  parking_spots: number | null;
};
const COLUNAS_IMOVEL = "id, title, address, city, state, status, owner_id, monthly_price, condo_fee, utilities_mode, utilities_estimate, area_m2, bedrooms, parking_spots";

export type ResultadoResumo = "enviado" | "vazio" | "desligado" | "teto" | "silencio" | "ocupado" | "falhou";

export interface OpcoesResumo {
  /** Só contas is_teste (o botão do QA). */
  soTeste?: boolean;
  /** Botão do QA: ignora o teto e o silêncio (só contas de teste; a regra é provada pelos testes puros). */
  ignorarTeto?: boolean;
}

/** Quem recebe: morador com pedido ativo ou busca salva com alerta. */
async function destinatarios(admin: Admin, soTeste: boolean): Promise<string[]> {
  const [{ data: peds }, { data: buscas }] = await Promise.all([
    admin.from("pedidos_moradia").select("inquilino_id").eq("status", "ativo").limit(5000),
    admin.from("buscas_salvas").select("usuario_id").eq("alerta_ativo", true).limit(5000),
  ]);
  const ids = [
    ...new Set([
      ...((peds ?? []) as { inquilino_id: string }[]).map((p) => p.inquilino_id),
      ...((buscas ?? []) as { usuario_id: string }[]).map((b) => b.usuario_id),
    ]),
  ].filter(Boolean);
  if (!soTeste || !ids.length) return ids;
  const { data } = await admin.from("profiles").select("id").in("id", ids).eq("is_teste", true);
  return ((data ?? []) as { id: string }[]).map((p) => p.id);
}

/** Os anúncios no ar por id, com a foto de capa. */
async function imoveisNoAr(admin: Admin, ids: string[]): Promise<Map<string, { linha: LinhaImovel; capa: string | null }>> {
  const unicos = [...new Set(ids)];
  if (!unicos.length) return new Map();
  const [{ data: props }, { data: fotos }] = await Promise.all([
    admin.from("properties").select(COLUNAS_IMOVEL).in("id", unicos).eq("status", "active"),
    admin.from("property_photos").select("property_id, url, sort_order").in("property_id", unicos).order("sort_order", { ascending: true }),
  ]);
  const capa = new Map<string, string>();
  for (const f of (fotos ?? []) as { property_id: string; url: string }[]) if (!capa.has(f.property_id)) capa.set(f.property_id, f.url);
  return new Map(((props ?? []) as LinhaImovel[]).map((p) => [p.id, { linha: p, capa: capa.get(p.id) ?? null }]));
}

function cartaoDe(i: { linha: LinhaImovel; capa: string | null }, motivo: string): ImovelDoCartao {
  const r = i.linha;
  return {
    id: r.id,
    titulo: r.title || "Imóvel mobiliado",
    // O bairro mora na coluna `address` (a página pública mostra só bairro e cidade; a rua, nunca).
    bairro: r.address,
    cidade: r.city,
    uf: r.state,
    totalMes: totalMesDaLinha(r),
    fotoCapa: i.capa,
    areaM2: r.area_m2,
    quartos: r.bedrooms,
    vagas: r.parking_spots,
    motivo,
  };
}

/** Candidatos de UMA pessoa: pedidos e buscas × anúncios novos, e os pendentes da fila. */
async function candidatosDaPessoa(
  admin: Admin,
  usuarioId: string,
  novosNoAr: Map<string, Property>,
): Promise<{ candidatos: CandidatoNovo[]; pendentes: CandidatoNovo[] }> {
  const candidatos: CandidatoNovo[] = [];
  const [{ data: peds }, { data: buscas }, { data: fila }] = await Promise.all([
    admin.from("pedidos_moradia").select("id, cidade").eq("inquilino_id", usuarioId).eq("status", "ativo"),
    admin.from("buscas_salvas").select("id, parametros").eq("usuario_id", usuarioId).eq("alerta_ativo", true),
    admin
      .from("emails_proativos")
      .select("id, evento, ref_id, extra")
      .eq("usuario_id", usuarioId)
      .in("evento", ["pedido_imovel_novo", "saved_search_match"])
      .is("enviado_em", null)
      .is("descartado_em", null)
      .order("criado_em", { ascending: true })
      .limit(100),
  ]);
  const pedidos = (peds ?? []) as { id: string; cidade: string | null }[];
  const buscasAtivas = (buscas ?? []) as { id: string; parametros: string }[];
  const paresPorPedido = new Map<string, Awaited<ReturnType<typeof paresCompat>>>();
  for (const p of pedidos) paresPorPedido.set(p.id, (await paresCompat(admin, { pedido: p.id })).filter((x) => x.situacao === "compativel"));

  // (a) pedido: a mesma função do banco do aviso, só com anúncio publicado na semana.
  for (const p of pedidos) {
    for (const par of paresPorPedido.get(p.id) ?? []) {
      if (!novosNoAr.has(par.imovel_id)) continue;
      candidatos.push({ imovelId: par.imovel_id, origem: "pedido", motivo: motivoDoPedido({ ...par, cidade: p.cidade }), cidade: novosNoAr.get(par.imovel_id)?.city });
    }
  }
  // (a) busca: a mesma regra do alerta (imovelBateComBusca), sem o próprio anúncio da pessoa.
  for (const b of buscasAtivas) {
    for (const imovel of novosNoAr.values()) {
      if (imovel.ownerId === usuarioId || !imovelBateComBusca(b.parametros, imovel)) continue;
      const f = fatosDaBusca(b.parametros, { preco: precoDeBusca(imovel), quartos: imovel.bedrooms, aceitaPet: imovel.petsAllowed });
      candidatos.push({ imovelId: imovel.id, origem: "busca", motivo: motivoDaBusca(f), cidade: imovel.city });
    }
  }
  // Pendentes da fila (E264-B): o motivo sai do pedido ou da busca de origem da linha (só o que bate de verdade).
  const pendentes: CandidatoNovo[] = [];
  for (const l of (fila ?? []) as { id: string; evento: string; ref_id: string; extra: Record<string, unknown> | null }[]) {
    if (l.evento === "pedido_imovel_novo") {
      const pedidoId = String(l.extra?.pedido_id ?? "");
      const par = (paresPorPedido.get(pedidoId) ?? []).find((x) => x.imovel_id === l.ref_id);
      const cidade = pedidos.find((p) => p.id === pedidoId)?.cidade ?? null;
      pendentes.push({ imovelId: l.ref_id, origem: "pedido", motivo: par ? motivoDoPedido({ ...par, cidade }) : "Combina com o seu pedido de moradia.", linhaFila: l.id });
    } else {
      const busca = buscasAtivas.find((b) => b.id === String(l.extra?.busca_id ?? ""));
      if (!busca) continue; // busca desligada: o despacho normal descarta a linha.
      const imovel = novosNoAr.get(l.ref_id) ?? (await getProperty(l.ref_id).catch(() => undefined));
      const f = imovel ? fatosDaBusca(busca.parametros, { preco: precoDeBusca(imovel), quartos: imovel.bedrooms, aceitaPet: imovel.petsAllowed }) : {};
      pendentes.push({ imovelId: l.ref_id, origem: "busca", motivo: motivoDaBusca(f), linhaFila: l.id });
    }
  }
  return { candidatos, pendentes };
}

/** Monta e envia o resumo de UMA pessoa. Nunca lança. */
export async function enviarResumoDaPessoa(
  admin: Admin,
  usuarioId: string,
  contexto: { agora: Date; novosNoAr: Map<string, Property>; opcoes: OpcoesResumo },
): Promise<ResultadoResumo> {
  const { agora, novosNoAr, opcoes } = contexto;
  try {
    const { data: perfil } = await admin
      .from("profiles")
      .select("email, full_name, notif_email, pausada_em, notif_categorias_desligadas, is_teste")
      .eq("id", usuarioId)
      .maybeSingle();
    const p = perfil as { email?: string | null; full_name?: string | null; notif_email?: boolean | null; pausada_em?: string | null; notif_categorias_desligadas?: string[] | null; is_teste?: boolean | null } | null;
    if (opcoes.soTeste && p?.is_teste !== true) return "desligado";
    if (!p?.email || !recebeAvisoComum(p) || (p.notif_categorias_desligadas ?? []).includes(CATEGORIA_PROATIVOS)) return "desligado";
    if (!opcoes.ignorarTeto) {
      const pode = podeEnviarProativo(await enviosRecentes(admin, usuarioId, agora), agora);
      if (pode !== "ok") return pode;
    }

    const { candidatos, pendentes } = await candidatosDaPessoa(admin, usuarioId, novosNoAr);
    // O que já saiu para a pessoa (qualquer proativo) e as quedas que já saíram no resumo.
    const { data: saidos } = await admin.from("emails_proativos").select("evento, ref_id, extra").eq("usuario_id", usuarioId).not("enviado_em", "is", null).limit(5000);
    const jaEnviados = new Set<string>();
    const quedasJaEnviadas = new Set<string>();
    for (const r of (saidos ?? []) as { evento: string; ref_id: string; extra: Record<string, unknown> | null }[]) {
      if (r.extra?.queda_id) quedasJaEnviadas.add(String(r.extra.queda_id));
      else jaEnviados.add(r.ref_id);
    }
    // (b) favoritos que baixaram de valor na semana.
    const { data: favs } = await admin.from("favorites").select("property_id").eq("tenant_id", usuarioId).limit(500);
    const favoritos = ((favs ?? []) as { property_id: string }[]).map((f) => f.property_id);
    const { data: qs } = favoritos.length
      ? await admin.from("quedas_preco").select("id, property_id, total_antigo, total_novo, registrada_em").in("property_id", favoritos).gte("registrada_em", inicioDaJanela(agora))
      : { data: [] };
    const quedas: CandidatoQueda[] = ((qs ?? []) as { id: string; property_id: string; total_antigo: number; total_novo: number; registrada_em: string }[]).map((q) => ({
      imovelId: q.property_id,
      quedaId: q.id,
      totalAntigo: Number(q.total_antigo),
      totalNovo: Number(q.total_novo),
      registradaEm: q.registrada_em,
    }));

    // Só o que ainda está no ar entra (o pendente de anúncio fora do ar fica para o despacho normal descartar).
    const noAr = await imoveisNoAr(admin, [...candidatos, ...pendentes].map((c) => c.imovelId).concat(quedas.map((q) => q.imovelId)));
    const sel = selecionarResumo({
      candidatos: candidatos.filter((c) => noAr.has(c.imovelId)),
      pendentesFila: pendentes.filter((c) => noAr.has(c.imovelId)),
      quedas: quedas.filter((q) => noAr.has(q.imovelId)),
      jaEnviados,
      quedasJaEnviadas,
    });
    if (!temNovidade(sel)) return "vazio";
    if ((await situacaoLimite(`resumo-semanal:${usuarioId}`, 1, 60)) === "estourou") return "ocupado";

    // Reserva: uma linha do resumo por cartão (conta no teto pelo envio_id) e os pendentes absorvidos da fila.
    const envioId = randomUUID();
    const semana = diaBrasilia(agora);
    const quando = agora.toISOString();
    const linhas = [
      ...sel.novos.map((n) => ({ usuario_id: usuarioId, evento: EVENTO_RESUMO, ref_id: n.imovelId, chave: chaveResumo(usuarioId, n.imovelId, semana), extra: { secao: "novos", origem: n.origem }, enviado_em: quando, envio_id: envioId })),
      ...sel.baixas.map((b) => ({ usuario_id: usuarioId, evento: EVENTO_RESUMO, ref_id: b.imovelId, chave: chaveResumo(usuarioId, b.imovelId, semana, b.quedaId), extra: { secao: "baixas", queda_id: b.quedaId }, enviado_em: quando, envio_id: envioId })),
    ];
    const { data: reservadas, error: erroReserva } = await admin.from("emails_proativos").upsert(linhas, { onConflict: "chave", ignoreDuplicates: true }).select("ref_id, chave");
    if (erroReserva) return "falhou";
    const minhas = new Set(((reservadas ?? []) as { chave: string }[]).map((r) => r.chave));
    const novos = sel.novos.filter((n) => minhas.has(chaveResumo(usuarioId, n.imovelId, semana)));
    const baixas = sel.baixas.filter((b) => minhas.has(chaveResumo(usuarioId, b.imovelId, semana, b.quedaId)));
    if (!novos.length && !baixas.length) return "ocupado";
    if (sel.filaAbsorvida.length) {
      await admin.from("emails_proativos").update({ enviado_em: quando, envio_id: envioId }).in("id", sel.filaAbsorvida).is("enviado_em", null).is("descartado_em", null);
    }

    const segredo = process.env.CRON_SECRET ?? "";
    const urls = segredo ? urlsDescadastro(SITE_URL, usuarioId, segredo) : null;
    const m = montarEmailResumoSemanal({
      siteUrl: SITE_URL,
      nome: primeiroNome(p.full_name),
      origem: origemDoResumo(novos),
      novos: novos.map((n) => cartaoDe(noAr.get(n.imovelId)!, n.motivo)),
      baixas: baixas.map((b) => cartaoDe(noAr.get(b.imovelId)!, motivoDaQueda(b))),
      descadastroUrl: urls?.pagina ?? null,
    });
    const r = await notify({
      event: EVENTO_RESUMO,
      email: p.email,
      name: p.full_name ?? undefined,
      userId: usuarioId,
      pushUrl: m.pushUrl,
      subject: m.assunto,
      body: m.abertura,
      detailsHtml: m.detailsHtml,
      detailsText: m.detailsText,
      semPush: true,
      descadastroUmCliqueUrl: urls?.umClique,
    });
    if (!r.email) {
      // Não saiu: as linhas do resumo saem e os pendentes voltam para a fila.
      await admin.from("emails_proativos").delete().eq("envio_id", envioId).eq("evento", EVENTO_RESUMO);
      await admin.from("emails_proativos").update({ enviado_em: null, envio_id: null }).eq("envio_id", envioId);
      return "falhou";
    }
    return "enviado";
  } catch (e) {
    console.error("[resumo-semanal] pessoa:", e instanceof Error ? e.message : e);
    return "falhou";
  }
}

/** Os anúncios publicados nos últimos 7 dias (publicado_em, 0275), já no formato do alerta de busca. */
async function publicadosNaSemana(admin: Admin, agora: Date): Promise<Map<string, Property>> {
  const { data } = await admin.from("properties").select("id").eq("status", "active").gte("publicado_em", inicioDaJanela(agora)).limit(500);
  const mapa = new Map<string, Property>();
  for (const { id } of (data ?? []) as { id: string }[]) {
    const p = await getProperty(id).catch(() => undefined);
    if (p && p.status === "active") mapa.set(id, p);
  }
  return mapa;
}

export interface TotaisResumo {
  pessoas: number;
  enviados: number;
  porResultado: Partial<Record<ResultadoResumo, number>>;
}

/** O resumo da semana para todos os destinatários (ou só as contas de teste, no botão do QA). */
export async function enviarResumosSemanais(agora = new Date(), opcoes: OpcoesResumo = {}): Promise<TotaisResumo> {
  const admin = createAdminClient();
  const totais: TotaisResumo = { pessoas: 0, enviados: 0, porResultado: {} };
  if (!admin) return totais;
  const pessoas = await destinatarios(admin, !!opcoes.soTeste);
  const novosNoAr = await publicadosNaSemana(admin, agora);
  totais.pessoas = pessoas.length;
  for (const u of pessoas) {
    const r = await enviarResumoDaPessoa(admin, u, { agora, novosNoAr, opcoes });
    totais.porResultado[r] = (totais.porResultado[r] ?? 0) + 1;
    if (r === "enviado") totais.enviados += 1;
  }
  return totais;
}
