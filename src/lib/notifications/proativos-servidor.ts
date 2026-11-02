import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/site";
import { totalMesDaLinha } from "@/lib/precos";
import { situacaoLimite } from "@/lib/limites";
import { notify } from "@/lib/notifications";
import { recebeAvisoComum } from "./preferencias";
import { montarEmailProativo, type ItemProativo } from "./email-proativo";
import { CATEGORIA_PROATIVOS, chaveProativo, escolherLote, eventoDoEnvio, podeEnviarProativo, urlsDescadastro, type EventoNaFila, type PodeEnviar } from "./proativos";

/*
  E264-B — fila e envio dos e-mails PROATIVOS (SERVER-ONLY). Quem gera o aviso só ENFILEIRA (uma linha por pessoa,
  evento e imóvel/pedido: a chave única é o "sem repetição"); o envio é sempre por aqui, agrupado, com o teto por
  pessoa (1 por dia, 3 por semana) e o silêncio das 22h às 7h. O que não cabe fica na fila e sai no próximo envio
  (o próximo aviso da pessoa ou o disparo diário). As linhas que vão num e-mail são reservadas ANTES do envio (envio_id):
  dois disparos ao mesmo tempo nunca mandam o mesmo cartão duas vezes (o caso de 23/10).
*/

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
type Linha = { id: string; evento: EventoNaFila; ref_id: string; extra: Record<string, unknown> | null; criado_em: string };

/** Entra na fila (ignora a repetição). true = linha nova. */
export async function enfileirarProativo(
  admin: Admin,
  p: { usuarioId: string; evento: EventoNaFila; refId: string; ciclo?: string | null; extra?: Record<string, unknown> },
): Promise<boolean> {
  const { error } = await admin.from("emails_proativos").insert({
    usuario_id: p.usuarioId,
    evento: p.evento,
    ref_id: p.refId,
    chave: chaveProativo(p.usuarioId, p.evento, p.refId, p.ciclo),
    extra: p.extra ?? {},
  });
  if (error && error.code !== "23505") console.error("[proativos] fila:", error.code, error.message);
  return !error;
}

async function descartar(admin: Admin, ids: string[], motivo: string): Promise<void> {
  if (!ids.length) return;
  await admin.from("emails_proativos").update({ descartado_em: new Date().toISOString(), motivo_descarte: motivo }).in("id", ids).is("enviado_em", null);
}

/** Quando saiu cada e-mail proativo da pessoa nos últimos 8 dias (um por envio_id). E375-B: o resumo semanal usa a mesma. */
// Achado 119: as leituras do despacho LANÇAM na falha (o try do despachar devolve "vazio" e nada é descartado; a próxima
// rodada tenta de novo). Antes: perfil não lido → a fila inteira descartada como "desligado"; imóveis/pedidos/buscas não
// lidos → itens descartados como "indisponível"; envios recentes não lidos → o teto de e-mails era ignorado.
const MSG_PROATIVOS_SEM_LEITURA = "Leitura do despacho de e-mails proativos falhou.";

export async function enviosRecentes(admin: Admin, usuarioId: string, agora: Date): Promise<string[]> {
  const { data, error } = await admin
    .from("emails_proativos")
    .select("envio_id, enviado_em")
    .eq("usuario_id", usuarioId)
    .not("enviado_em", "is", null)
    .gte("enviado_em", new Date(agora.getTime() - 8 * 86_400_000).toISOString())
    .limit(500);
  if (error) throw new Error(MSG_PROATIVOS_SEM_LEITURA);
  const porEnvio = new Map<string, string>();
  for (const r of (data ?? []) as { envio_id: string | null; enviado_em: string }[]) porEnvio.set(r.envio_id ?? r.enviado_em, r.enviado_em);
  return [...porEnvio.values()];
}

/** Os cartões do lote. Item que não vale mais (imóvel fora do ar, pedido encerrado, busca desligada) é descartado. */
async function itensDoLote(admin: Admin, usuarioId: string, evento: EventoNaFila, linhas: Linha[], agora: Date): Promise<{ itens: { linha: Linha; item: ItemProativo }[]; descartes: string[]; dias?: number | null }> {
  const ids = linhas.map((l) => l.ref_id);
  const itens: { linha: Linha; item: ItemProativo }[] = [];
  const descartes: string[] = [];
  if (evento === "pedido_imovel_novo" || evento === "saved_search_match") {
    const [{ data: props, error: e1 }, { data: fotos, error: e2 }] = await Promise.all([
      admin.from("properties").select("id, title, address, city, state, status, monthly_price, condo_fee, utilities_mode, utilities_estimate").in("id", ids),
      admin.from("property_photos").select("property_id, url, sort_order").in("property_id", ids).order("sort_order", { ascending: true }),
    ]);
    if (e1 || e2) throw new Error(MSG_PROATIVOS_SEM_LEITURA);
    let buscasAtivas: Set<string> | null = null;
    if (evento === "saved_search_match") {
      const { data: b, error: e3 } = await admin.from("buscas_salvas").select("id").eq("usuario_id", usuarioId).eq("alerta_ativo", true);
      if (e3) throw new Error(MSG_PROATIVOS_SEM_LEITURA);
      buscasAtivas = new Set(((b ?? []) as { id: string }[]).map((x) => x.id));
    }
    const capa = new Map<string, string>();
    for (const f of (fotos ?? []) as { property_id: string; url: string }[]) if (!capa.has(f.property_id)) capa.set(f.property_id, f.url);
    const porId = new Map(((props ?? []) as Record<string, unknown>[]).map((r) => [r.id as string, r]));
    for (const l of linhas) {
      const r = porId.get(l.ref_id);
      const buscaOk = !buscasAtivas || buscasAtivas.has(String(l.extra?.busca_id ?? ""));
      if (!r || r.status !== "active" || !buscaOk) {
        descartes.push(l.id);
        continue;
      }
      itens.push({
        linha: l,
        item: {
          tipo: "imovel",
          imovel: {
            id: l.ref_id,
            titulo: (r.title as string) || "Imóvel mobiliado",
            // O bairro mora na coluna `address` (o anúncio público mostra só bairro e cidade; o endereço exato, nunca).
            bairro: (r.address as string | null) ?? null,
            cidade: (r.city as string | null) ?? null,
            uf: (r.state as string | null) ?? null,
            totalMes: totalMesDaLinha(r as Parameters<typeof totalMesDaLinha>[0]),
            fotoCapa: capa.get(l.ref_id) ?? null,
          },
        },
      });
    }
    return { itens, descartes };
  }
  const { data: peds, error: e4 } = await admin
    .from("pedidos_moradia")
    .select("id, status, cidade, uf, data_inicio, prazo_meses, qtd_ocupantes, orcamento_mensal, pets, expira_em")
    .in("id", ids);
  if (e4) throw new Error(MSG_PROATIVOS_SEM_LEITURA);
  const porId = new Map(((peds ?? []) as Record<string, unknown>[]).map((r) => [r.id as string, r]));
  let dias: number | null = null;
  for (const l of linhas) {
    const p = porId.get(l.ref_id);
    if (!p || p.status !== "ativo") {
      descartes.push(l.id);
      continue;
    }
    const pedido = {
      id: l.ref_id,
      cidade: String(p.cidade ?? ""),
      uf: (p.uf as string | null) ?? null,
      entrada: String(p.data_inicio ?? ""),
      meses: Number(p.prazo_meses) || 1,
      orcamento: Number(p.orcamento_mensal) || 0,
      pessoas: Number(p.qtd_ocupantes) || 1,
      pets: (p.pets as boolean | null) ?? null,
    };
    if (evento === "pedido_expirando") {
      const expira = Date.parse(String(p.expira_em ?? ""));
      if (!Number.isFinite(expira) || expira <= agora.getTime()) {
        descartes.push(l.id);
        continue;
      }
      const d = Math.ceil((expira - agora.getTime()) / 86_400_000);
      dias = dias == null ? d : Math.min(dias, d);
      itens.push({ linha: l, item: { tipo: "pedido", pedido, urlBotao: `${SITE_URL}/dashboard/pedidos` } });
      continue;
    }
    // pedido_compativel: só se ainda combina com um imóvel do dono (a mesma função do banco do aviso).
    const imovelId = String(l.extra?.imovel_id ?? "");
    const { data: pares, error: e5 } = await admin.rpc("compatibilidade_pedidos", { p_pedido: l.ref_id, p_imovel: null, p_dono: usuarioId });
    if (e5) throw new Error(MSG_PROATIVOS_SEM_LEITURA);
    const compat = ((pares ?? []) as { imovel_id: string; situacao: string; titulo: string | null }[]).filter((x) => x.situacao === "compativel");
    const par = compat.find((x) => x.imovel_id === imovelId) ?? compat[0];
    if (!par) {
      descartes.push(l.id);
      continue;
    }
    itens.push({
      linha: l,
      item: {
        tipo: "pedido",
        pedido,
        contexto: `Combina com “${par.titulo || "o seu imóvel"}”`,
        urlBotao: `${SITE_URL}/dashboard/pedidos-cidade?pedido=${encodeURIComponent(l.ref_id)}&imovel=${encodeURIComponent(par.imovel_id)}`,
      },
    });
  }
  return { itens, descartes, dias };
}

/** O que sair no e-mail marca a origem como enviada (os números do admin e as telas leem dali). */
async function marcarOrigem(admin: Admin, usuarioId: string, evento: EventoNaFila, refs: string[], agora: Date): Promise<void> {
  const quando = agora.toISOString();
  if (evento === "pedido_compativel") {
    await admin.from("pedido_avisos").update({ enviado_em: quando }).eq("dono_id", usuarioId).in("pedido_id", refs).is("enviado_em", null);
  } else if (evento === "saved_search_match") {
    const { data: b } = await admin.from("buscas_salvas").select("id").eq("usuario_id", usuarioId);
    const buscas = ((b ?? []) as { id: string }[]).map((x) => x.id);
    if (buscas.length) await admin.from("alertas_busca_envios").update({ enviado_em: quando }).in("busca_id", buscas).in("imovel_id", refs).is("enviado_em", null);
  }
}

export type ResultadoDespacho = "enviado" | "vazio" | "desligado" | "ocupado" | Exclude<PodeEnviar, "ok">;

/**
 * Manda (no máximo) UM e-mail proativo para a pessoa, se o silêncio e o teto deixarem: o lote do pendente mais antigo,
 * com até 3 cartões e "ver os N". Nunca lança.
 */
export async function despacharProativos(admin: Admin, usuarioId: string, agora = new Date()): Promise<ResultadoDespacho> {
  try {
    const { data: pend, error: erroPend } = await admin
      .from("emails_proativos")
      .select("id, evento, ref_id, extra, criado_em")
      .eq("usuario_id", usuarioId)
      .is("enviado_em", null)
      .is("descartado_em", null)
      .order("criado_em", { ascending: true })
      .limit(200);
    if (erroPend) throw new Error(MSG_PROATIVOS_SEM_LEITURA);
    let pendentes = (pend ?? []) as Linha[];
    if (!pendentes.length) return "vazio";

    const { data: perfil, error: erroPerfil } = await admin
      .from("profiles")
      .select("email, full_name, notif_email, pausada_em, notif_categorias_desligadas")
      .eq("id", usuarioId)
      .maybeSingle();
    // Sem o perfil, NÃO descarta a fila como "desligado" (seria perder os avisos de quem quer recebê-los).
    if (erroPerfil) throw new Error(MSG_PROATIVOS_SEM_LEITURA);
    const p = perfil as { email?: string | null; full_name?: string | null; notif_email?: boolean | null; pausada_em?: string | null; notif_categorias_desligadas?: string[] | null } | null;
    // Sem e-mail, avisos desligados, conta pausada ou "Sugestões e novidades" desligada: nada acumula para depois.
    if (!p?.email || !recebeAvisoComum(p) || (p.notif_categorias_desligadas ?? []).includes(CATEGORIA_PROATIVOS)) {
      await descartar(admin, pendentes.map((x) => x.id), "desligado");
      return "desligado";
    }

    const pode = podeEnviarProativo(await enviosRecentes(admin, usuarioId, agora), agora);
    if (pode !== "ok") return pode;
    // Um envio por vez para a pessoa: um segundo disparo no mesmo minuto deixa o dele na fila (sai no próximo).
    if ((await situacaoLimite(`proativo-envio:${usuarioId}`, 1, 60)) === "estourou") return "ocupado";

    for (let tentativa = 0; tentativa < 3 && pendentes.length; tentativa++) {
      const lote = escolherLote(pendentes);
      if (!lote) break;
      const { itens, descartes, dias } = await itensDoLote(admin, usuarioId, lote.evento, lote.itens, agora);
      await descartar(admin, descartes, "indisponivel");
      if (!itens.length) {
        pendentes = pendentes.filter((x) => x.evento !== lote.evento);
        continue;
      }
      // Reserva as linhas deste e-mail (quem chegar depois não as vê mais como pendentes).
      const envioId = randomUUID();
      const { data: reservadas } = await admin
        .from("emails_proativos")
        .update({ envio_id: envioId, enviado_em: agora.toISOString() })
        .in("id", itens.map((i) => i.linha.id))
        .is("enviado_em", null)
        .is("descartado_em", null)
        .select("id");
      const minhas = new Set(((reservadas ?? []) as { id: string }[]).map((r) => r.id));
      const doEnvio = itens.filter((i) => minhas.has(i.linha.id));
      if (!doEnvio.length) return "ocupado";

      const evento = eventoDoEnvio(lote.evento, doEnvio.length);
      const segredo = process.env.CRON_SECRET ?? "";
      const urls = segredo ? urlsDescadastro(SITE_URL, usuarioId, segredo) : null;
      const m = montarEmailProativo({ siteUrl: SITE_URL, evento, itens: doEnvio.map((i) => i.item), descadastroUrl: urls?.pagina ?? null, diasParaExpirar: dias });
      const r = await notify({
        event: evento,
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
        // Não saiu: as linhas voltam para a fila (o próximo disparo tenta de novo).
        await admin.from("emails_proativos").update({ envio_id: null, enviado_em: null }).eq("envio_id", envioId);
        return "vazio";
      }
      await marcarOrigem(admin, usuarioId, lote.evento, doEnvio.map((i) => i.linha.ref_id), agora);
      return "enviado";
    }
    return "vazio";
  } catch (e) {
    console.error("[proativos] despacho:", e instanceof Error ? e.message : e);
    return "vazio";
  }
}

/** Disparo diário: um envio (no máximo) para cada pessoa com pendência na fila. */
export async function despacharTodosProativos(agora = new Date()): Promise<{ pessoas: number; enviados: number }> {
  const admin = createAdminClient();
  if (!admin) return { pessoas: 0, enviados: 0 };
  const { data } = await admin.from("emails_proativos").select("usuario_id").is("enviado_em", null).is("descartado_em", null).limit(5000);
  const pessoas = [...new Set(((data ?? []) as { usuario_id: string }[]).map((r) => r.usuario_id))];
  let enviados = 0;
  for (const u of pessoas) if ((await despacharProativos(admin, u, agora)) === "enviado") enviados += 1;
  return { pessoas: pessoas.length, enviados };
}
