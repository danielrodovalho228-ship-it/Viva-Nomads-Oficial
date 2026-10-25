import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { idsContasTeste } from "@/lib/data/admin-indicadores";
import {
  JANELA_CORRECAO_DIAS,
  QUEBRADORES,
  contextoDoMotivo,
  motivosQueViramCorrecao,
  pctRevertidas,
  saidasPorMotivo,
  type ContextoMotivo,
  type PapelSaida,
  type SaidaRegistrada,
} from "@/lib/saida/regras";

/*
  Prompt 51, fase 1 — o painel de qualidade do admin, lido do que já existe: saidas_motivos (saídas e a métrica de ouro),
  qualidade_correcoes (o loop fechado), denuncias_anuncio, e o sinal precoce de cada quebrador (chamados, verificação,
  avaliações, pedidos de exclusão). Contas de teste fora.
*/

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
const DIA = 86_400_000;

interface LinhaSaida {
  id: string;
  user_id: string | null;
  papel: PapelSaida;
  nivel: string;
  motivo: string | null;
  detalhe: string | null;
  texto_livre: string | null;
  ajuda_oferecida: string | null;
  revertida: boolean;
  teste: boolean;
  criado_em: string;
}

const paraRegistrada = (s: LinhaSaida, teste: Set<string>): SaidaRegistrada => ({
  papel: s.papel,
  motivo: s.motivo,
  criadoEm: s.criado_em,
  ajudaOferecida: !!s.ajuda_oferecida,
  revertida: s.revertida,
  teste: s.teste || (!!s.user_id && teste.has(s.user_id)),
});

/**
 * Motivo com mais de 3 saídas em 30 dias vira Correção (sem dono e sem prazo até a equipe definir). Chamada ao gravar
 * cada motivo e na leitura do painel; o índice único (papel, motivo) das abertas impede a duplicata.
 */
export async function abrirCorrecoesDevidas(admin: Admin, agora = new Date()): Promise<void> {
  const desde = new Date(agora.getTime() - JANELA_CORRECAO_DIAS * DIA).toISOString();
  const [{ data: saidas }, { data: abertas }, teste] = await Promise.all([
    admin.from("saidas_motivos").select("id, user_id, papel, nivel, motivo, detalhe, texto_livre, ajuda_oferecida, revertida, teste, criado_em").gte("criado_em", desde).not("motivo", "is", null).limit(20000),
    admin.from("qualidade_correcoes").select("papel, motivo").is("fechada_em", null),
    idsContasTeste(admin),
  ]);
  const novas = motivosQueViramCorrecao(((saidas ?? []) as LinhaSaida[]).map((s) => paraRegistrada(s, teste)), (abertas ?? []) as { papel: string; motivo: string }[], agora);
  for (const n of novas) {
    const { error } = await admin.from("qualidade_correcoes").insert({ papel: n.papel, motivo: n.motivo, ocorrencias: n.n });
    if (error && error.code !== "23505") console.error("[abrirCorrecoesDevidas]", error.code, error.message);
  }
}

export interface Correcao {
  id: string;
  papel: PapelSaida;
  motivo: string;
  ocorrencias: number;
  dono: string | null;
  prazo: string | null;
  criadaEm: string;
  fechadaEm: string | null;
  ligacao: string | null;
}

export interface Denuncia {
  id: string;
  propertyId: string;
  titulo: string;
  motivo: string;
  texto: string | null;
  status: string;
  chamado: string | null;
  criadoEm: string;
}

export interface SaidaComContexto {
  id: string;
  papel: PapelSaida;
  nivel: string;
  motivo: string;
  contexto: ContextoMotivo;
  criadoEm: string;
}

export interface PainelQualidade {
  porMotivo: { papel: PapelSaida; motivo: string; n: number }[];
  totalSemana: number;
  pctRevertidas: number | null;
  baseRevertidas: number;
  quebradores: { chave: string; rotulo: string; sinal: string; href: string | null; n: number | null; faltaParaMedir: string | null }[];
  correcoes: Correcao[];
  denuncias: Denuncia[];
  comContexto: SaidaComContexto[];
}

async function contar(q: PromiseLike<{ count: number | null; error: unknown }>): Promise<number | null> {
  const { count, error } = await q;
  return error ? null : (count ?? 0);
}

export async function painelQualidade(agora = new Date()): Promise<PainelQualidade | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  await abrirCorrecoesDevidas(admin, agora).catch(() => null);
  const semana = new Date(agora.getTime() - 7 * DIA).toISOString();
  const mes = new Date(agora.getTime() - JANELA_CORRECAO_DIAS * DIA).toISOString();
  const teste = await idsContasTeste(admin);

  const [saidas, correcoes, denuncias, foraPrazo, comprovante, verificacao, avaliacoes, exclusoes] = await Promise.all([
    admin.from("saidas_motivos").select("id, user_id, papel, nivel, motivo, detalhe, texto_livre, ajuda_oferecida, revertida, teste, criado_em").gte("criado_em", mes).order("criado_em", { ascending: false }).limit(20000),
    admin.from("qualidade_correcoes").select("id, papel, motivo, ocorrencias, dono, prazo, criada_em, fechada_em, ligacao").or(`fechada_em.is.null,fechada_em.gte.${mes}`).order("criada_em", { ascending: false }).limit(200),
    admin.from("denuncias_anuncio").select("id, property_id, user_id, motivo, texto, status, chamado_numero, teste, criado_em, properties(title)").eq("teste", false).order("criado_em", { ascending: false }).limit(200),
    contar(admin.from("chamados").select("id", { count: "exact", head: true }).eq("sla_estado", "estourado").not("status", "in", "(resolvido,encerrado)").eq("simulacao", false)),
    contar(admin.from("chamados").select("id", { count: "exact", head: true }).gte("criado_em", semana).eq("simulacao", false).or("assunto.ilike.%comprovante%,assunto.ilike.%recibo%")),
    contar(admin.from("verificacao_revisoes").select("id", { count: "exact", head: true }).is("decidido_em", null).lt("criado_em", new Date(agora.getTime() - DIA).toISOString())),
    admin.from("avaliacoes").select("autor_id").eq("papel_autor", "inquilino").lte("nota_geral", 2).gte("enviada_em", semana).limit(2000),
    admin.from("exclusao_conta_pedidos").select("uid").gte("criado_em", semana).limit(5000),
  ]);

  const linhas = ((saidas.data ?? []) as LinhaSaida[]).filter((s) => !s.teste && !(s.user_id && teste.has(s.user_id)));
  const registradas = linhas.map((s) => paraRegistrada(s, teste));
  const porMotivo = saidasPorMotivo(registradas, agora);
  const naSemana = registradas.filter((s) => Date.parse(s.criadoEm) >= Date.parse(semana));
  const listaDenuncias = ((denuncias.data ?? []) as unknown as { id: string; property_id: string; user_id: string; motivo: string; texto: string | null; status: string; chamado_numero: string | null; criado_em: string; properties: { title: string | null } | null }[])
    .filter((d) => !teste.has(d.user_id))
    .map((d) => ({ id: d.id, propertyId: d.property_id, titulo: d.properties?.title ?? "Anúncio", motivo: d.motivo, texto: d.texto, status: d.status, chamado: d.chamado_numero, criadoEm: d.criado_em }));
  const semTeste = <T extends { autor_id?: string | null; uid?: string | null }>(r: { data: T[] | null; error: unknown }) =>
    r.error ? null : (r.data ?? []).filter((x) => !teste.has((x.autor_id ?? x.uid) ?? "")).length;

  const contagem: Record<string, number | null> = {
    chamado_fora_prazo: foraPrazo,
    comprovante_suporte: comprovante,
    verificacao_parada: verificacao,
    avaliacao_baixa: semTeste(avaliacoes as { data: { autor_id: string }[] | null; error: unknown }),
    exclusao_email: semTeste(exclusoes as { data: { uid: string | null }[] | null; error: unknown }),
    denuncia_anuncio: listaDenuncias.filter((d) => d.status !== "resolvida").length,
  };

  return {
    porMotivo,
    totalSemana: naSemana.length,
    pctRevertidas: pctRevertidas(registradas),
    baseRevertidas: registradas.filter((s) => s.ajudaOferecida).length,
    quebradores: QUEBRADORES.map((q) => ({ chave: q.chave, rotulo: q.rotulo, sinal: q.sinal, href: q.href, n: q.semMedicao ? null : (contagem[q.chave] ?? null), faltaParaMedir: q.faltaParaMedir ?? null })),
    correcoes: ((correcoes.data ?? []) as { id: string; papel: PapelSaida; motivo: string; ocorrencias: number; dono: string | null; prazo: string | null; criada_em: string; fechada_em: string | null; ligacao: string | null }[]).map((c) => ({
      id: c.id,
      papel: c.papel,
      motivo: c.motivo,
      ocorrencias: c.ocorrencias,
      dono: c.dono,
      prazo: c.prazo,
      criadaEm: c.criada_em,
      fechadaEm: c.fechada_em,
      ligacao: c.ligacao,
    })),
    denuncias: listaDenuncias,
    comContexto: linhas
      .filter((s) => s.user_id && contextoDoMotivo(s.motivo))
      .slice(0, 50)
      .map((s) => ({ id: s.id, papel: s.papel, nivel: s.nivel, motivo: s.motivo!, contexto: contextoDoMotivo(s.motivo)!, criadoEm: s.criado_em })),
  };
}

export interface ItemContexto {
  rotulo: string;
  href: string;
}

/** O que o motivo de UMA saída abre: os chamados da pessoa, os contratos e pedidos de parceiro, ou o anúncio. */
export async function contextoDaSaida(id: string): Promise<{ contexto: ContextoMotivo; itens: ItemContexto[] } | null> {
  const admin = createAdminClient();
  if (!admin || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data: s } = await admin.from("saidas_motivos").select("user_id, motivo").eq("id", id).maybeSingle();
  const contexto = contextoDoMotivo((s?.motivo as string | null) ?? null);
  if (!s?.user_id || !contexto) return null;
  const uid = s.user_id as string;

  if (contexto === "chamados") {
    const { data } = await admin.from("chamados").select("id, numero_publico, assunto, status").eq("usuario_id", uid).order("criado_em", { ascending: false }).limit(20);
    return { contexto, itens: ((data ?? []) as { id: string; numero_publico: string; assunto: string; status: string }[]).map((c) => ({ rotulo: `${c.numero_publico} · ${c.assunto} · ${c.status}`, href: `/admin/atendimento/${c.id}` })) };
  }
  if (contexto === "pagamentos") {
    const [comoMorador, comoDono, pedidos] = await Promise.all([
      admin.from("contratos").select("id, status, properties(title)").eq("tenant_id", uid).order("created_at", { ascending: false }).limit(10),
      admin.from("contratos").select("id, status, properties!inner(title, owner_id)").eq("properties.owner_id", uid).order("created_at", { ascending: false }).limit(10),
      admin.from("parceiro_pedidos").select("id, status").eq("cliente_id", uid).order("criado_em", { ascending: false }).limit(10),
    ]);
    const contratos = [...((comoMorador.data ?? []) as unknown[]), ...((comoDono.data ?? []) as unknown[])] as { id: string; status: string; properties: { title: string | null } | null }[];
    return {
      contexto,
      itens: [
        ...contratos.map((c) => ({ rotulo: `Contrato · ${c.properties?.title ?? "imóvel"} · ${c.status}`, href: `/admin/contratos/${c.id}` })),
        ...((pedidos.data ?? []) as { id: string; status: string }[]).map((p) => ({ rotulo: `Pedido de parceiro · ${p.status}`, href: "/admin/servicos" })),
      ],
    };
  }
  const { data } = await admin.from("contratos").select("property_id, properties(title)").eq("tenant_id", uid).order("created_at", { ascending: false }).limit(3);
  return { contexto, itens: ((data ?? []) as unknown as { property_id: string; properties: { title: string | null } | null }[]).map((c) => ({ rotulo: c.properties?.title ?? "Anúncio", href: `/imoveis/${c.property_id}` })) };
}
