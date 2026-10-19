import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { chaveCidade } from "@/lib/cidades";
import {
  agregarContratos,
  resolvidosAtendimento,
  respostaPedidos,
  type ContratoParaAgregado,
  type PedidoParaMetrica,
} from "@/lib/admin/indicadores";

/*
  Leituras do admin "uma fonte só" (Prompt 29). Cada função aqui é a ÚNICA origem do seu número: a home, a página
  da área e o selo da barra lateral chamam a mesma. Sempre pelo cliente de serviço e só depois de o layout de
  /admin ter conferido que é admin (os chamadores fora do admin conferem por conta própria). Contas is_teste e
  anúncios [TESTE…] ficam fora.
*/

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
const MARCA_TESTE = /^\s*\[\s*(teste|test|qa)\b[^\]]*\]/i;

/** [início, fim) em ISO a partir de datas AAAA-MM-DD do período, no horário de Brasília (como a 0069). */
export function intervaloBRT(inicio: string, fim: string): { ini: string; fim: string } {
  const ini = new Date(`${inicio}T00:00:00-03:00`);
  const f = new Date(`${fim}T00:00:00-03:00`);
  f.setUTCDate(f.getUTCDate() + 1);
  return { ini: ini.toISOString(), fim: f.toISOString() };
}

/** Ids das contas de teste (para tirar dos números). */
export async function idsContasTeste(admin: Admin): Promise<Set<string>> {
  const { data } = await admin.from("profiles").select("id").eq("is_teste", true).limit(5000);
  return new Set(((data ?? []) as { id: string }[]).map((p) => p.id));
}

export interface ContratoLinhaAdmin extends ContratoParaAgregado {
  id: string;
  criadoEm: string;
  status: string;
  propertyId: string;
  imovel: string;
  cidade: string | null;
  ownerId: string;
  tenantId: string;
  assinadoDono: boolean;
  assinadoInquilino: boolean;
}

/**
 * Contratos (reais) criados no período — a mesma lista para o Financeiro, a home e /admin/contratos.
 * Sem período: todos.
 */
export async function contratosReais(admin: Admin, periodo?: { ini: string; fim: string }, cidade?: string | null): Promise<ContratoLinhaAdmin[]> {
  const k = cidade ? chaveCidade(cidade) : null;
  let q = admin
    .from("contratos")
    .select("id, created_at, status, property_id, tenant_id, aluguel_mensal, prazo_total_dias, comissao_valor, comissao_percent, assinado_proprietario_em, assinado_inquilino_em, properties!inner(owner_id, title, city)")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (periodo) q = q.gte("created_at", periodo.ini).lt("created_at", periodo.fim);
  const [{ data }, teste] = await Promise.all([q, idsContasTeste(admin)]);
  return ((data ?? []) as unknown as {
    id: string;
    created_at: string;
    status: string;
    property_id: string;
    tenant_id: string;
    aluguel_mensal: number | null;
    prazo_total_dias: number | null;
    comissao_valor: number | null;
    comissao_percent: number | null;
    assinado_proprietario_em: string | null;
    assinado_inquilino_em: string | null;
    properties: { owner_id: string; title: string | null; city: string | null };
  }[])
    .filter((c) => !teste.has(c.tenant_id) && !teste.has(c.properties.owner_id) && !MARCA_TESTE.test(c.properties.title ?? ""))
    .filter((c) => !k || chaveCidade(c.properties.city) === k)
    .map((c) => ({
      id: c.id,
      criadoEm: c.created_at,
      status: c.status,
      propertyId: c.property_id,
      imovel: c.properties.title ?? "Imóvel",
      cidade: c.properties.city,
      ownerId: c.properties.owner_id,
      tenantId: c.tenant_id,
      assinadoDono: !!c.assinado_proprietario_em,
      assinadoInquilino: !!c.assinado_inquilino_em,
      aluguelMensal: c.aluguel_mensal === null ? null : Number(c.aluguel_mensal),
      prazoDias: c.prazo_total_dias === null ? null : Number(c.prazo_total_dias),
      taxaValor: c.comissao_valor === null ? null : Number(c.comissao_valor),
      taxaPercent: c.comissao_percent === null ? null : Number(c.comissao_percent),
    }));
}

/** Pedidos de moradia (de contas reais) criados no período, com a 1ª resposta (contato ou proposta). */
export async function pedidosParaMetrica(
  admin: Admin,
  periodo: { ini: string; fim: string },
  cidade?: string | null
): Promise<(PedidoParaMetrica & { id: string })[]> {
  const k = cidade ? chaveCidade(cidade) : null;
  const [{ data: pedidos }, teste] = await Promise.all([
    admin.from("pedidos_moradia").select("id, inquilino_id, criado_em, cidade").gte("criado_em", periodo.ini).lt("criado_em", periodo.fim).limit(5000),
    idsContasTeste(admin),
  ]);
  const reais = ((pedidos ?? []) as { id: string; inquilino_id: string; criado_em: string; cidade: string | null }[]).filter(
    (p) => !teste.has(p.inquilino_id) && (!k || chaveCidade(p.cidade) === k)
  );
  if (!reais.length) return [];
  const { data: resp } = await admin.from("respostas_pedido").select("pedido_id, criado_em").in("pedido_id", reais.map((p) => p.id)).order("criado_em", { ascending: true });
  const primeira = new Map<string, string>();
  for (const r of (resp ?? []) as { pedido_id: string; criado_em: string }[]) if (!primeira.has(r.pedido_id)) primeira.set(r.pedido_id, r.criado_em);
  return reais.map((p) => ({ id: p.id, criadoEm: p.criado_em, primeiraRespostaEm: primeira.get(p.id) ?? null }));
}

/** Fila de documentos AGORA: documentos de imóvel em revisão (um por imóvel+arquivo) + matrículas em revisão. */
export async function filaDocumentos(admin: Admin): Promise<{ documentos: number; matriculas: number; total: number; maisAntigoEm: string | null }> {
  const [{ data: docs }, { data: mats }] = await Promise.all([
    admin.from("qualification_checklists").select("owner_id, property_id, document_path, document_uploaded_at, created_at").eq("document_status", "pending").limit(500),
    admin.from("property_ownership_checks").select("id, criada_em").in("resultado", ["em_revisao", "provavel"]).is("revisado_em", null).limit(500),
  ]);
  const chaves = new Set<string>();
  let maisAntigo: string | null = null;
  const considera = (d: string | null) => {
    if (d && (!maisAntigo || d < maisAntigo)) maisAntigo = d;
  };
  for (const d of (docs ?? []) as { owner_id: string; property_id: string; document_path: string | null; document_uploaded_at: string | null; created_at: string }[]) {
    chaves.add(`${d.owner_id}|${d.property_id}|${d.document_path ?? ""}`);
    considera(d.document_uploaded_at ?? d.created_at);
  }
  const matriculas = (mats ?? []) as { criada_em: string }[];
  for (const m of matriculas) considera(m.criada_em);
  return { documentos: chaves.size, matriculas: matriculas.length, total: chaves.size + matriculas.length, maisAntigoEm: maisAntigo };
}

/** Agentes: os três números com nome (item 10). */
export async function contadoresAgentes(admin: Admin): Promise<{ aguardandoOk: number; ordensPendentes: number; ordensLidas: number }> {
  const conta = async (p: PromiseLike<{ count: number | null }>) => (await p).count ?? 0;
  const [aguardandoOk, ordensPendentes, ordensLidas] = await Promise.all([
    conta(admin.from("aprovacoes").select("id", { count: "exact", head: true }).eq("status", "pendente").gt("expira_em", new Date().toISOString())),
    conta(admin.from("agentes_ordens").select("id", { count: "exact", head: true }).eq("status", "pendente")),
    conta(admin.from("agentes_ordens").select("id", { count: "exact", head: true }).eq("status", "lida")),
  ]);
  return { aguardandoOk, ordensPendentes, ordensLidas };
}

/** Atendimento: chamados abertos AGORA (não resolvidos nem encerrados; simulação fora). */
export async function chamadosAbertosAgora(admin: Admin): Promise<number> {
  const { count } = await admin.from("chamados").select("id", { count: "exact", head: true }).eq("simulacao", false).not("status", "in", "(resolvido,encerrado)");
  return count ?? 0;
}

/** Manutenção: solicitações abertas no período (imóveis reais, sem simulação) — a lista de /admin/solicitacoes. */
export async function solicitacoesManutencao(admin: Admin, periodo: { ini: string; fim: string }, cidade?: string | null) {
  const k = cidade ? chaveCidade(cidade) : null;
  const [{ data }, teste] = await Promise.all([
    admin
      .from("service_orders")
      .select("id, category, priority, status, opened_at, first_response_at, resolved_at, simulacao, properties!inner(owner_id, title, city)")
      .gte("opened_at", periodo.ini)
      .lt("opened_at", periodo.fim)
      .order("opened_at", { ascending: false })
      .limit(2000),
    idsContasTeste(admin),
  ]);
  return ((data ?? []) as unknown as {
    id: string;
    category: string | null;
    priority: string | null;
    status: string;
    opened_at: string;
    first_response_at: string | null;
    resolved_at: string | null;
    simulacao: boolean | null;
    properties: { owner_id: string; title: string | null; city: string | null };
  }[]).filter(
    (s) => !s.simulacao && !teste.has(s.properties.owner_id) && !MARCA_TESTE.test(s.properties.title ?? "") && (!k || chaveCidade(s.properties.city) === k)
  );
}

/** Atendimento na janela móvel de N dias: a MESMA função das Métricas de /admin/atendimento (admin_atendimento_metricas). */
export async function metricasAtendimentoJanela(admin: Admin, dias: number): Promise<Record<string, unknown> | null> {
  const { data, error } = await admin.rpc("admin_atendimento_metricas", { p_dias: dias });
  if (error) return null;
  return data as Record<string, unknown>;
}

/**
 * Os números da home que saem das funções "uma fonte só" (chaves x_*), para o período e a cidade: contratos e taxa,
 * pedidos com resposta e solicitações de manutenção. Cada página da área chama as mesmas funções.
 */
export async function extrasDoPeriodo(admin: Admin, inicio: string, fim: string, cidade: string | null): Promise<Record<string, number | null>> {
  const periodo = intervaloBRT(inicio, fim);
  const [contratos, pedidos, solicitacoes] = await Promise.all([
    contratosReais(admin, periodo, cidade),
    pedidosParaMetrica(admin, periodo, cidade),
    solicitacoesManutencao(admin, periodo, cidade),
  ]);
  const ag = agregarContratos(contratos);
  const pr = respostaPedidos(pedidos);
  return {
    x_contratos: ag.contratos,
    x_valor_total: ag.valorTotal,
    x_taxa: ag.taxa,
    x_take_rate: ag.takeRate,
    x_valor_mensal: ag.valorMensalSoma,
    x_regra_anterior: ag.regraAnterior,
    x_pedidos: pr.total,
    x_pedidos_com_resposta: pr.comResposta,
    x_pedidos_taxa: pr.taxa,
    x_pedidos_mediana_h: pr.medianaHoras,
    x_solicitacoes: solicitacoes.length,
    x_solicitacoes_resolvidas: solicitacoes.filter((s) => s.resolved_at).length,
  };
}

/** Atendimento para a home (janela de N dias até agora + a fila de agora). */
export async function extrasAtendimento(admin: Admin, dias: number): Promise<Record<string, number | null>> {
  const [m, abertos] = await Promise.all([metricasAtendimentoJanela(admin, dias), chamadosAbertosAgora(admin)]);
  const n = (v: unknown) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));
  return {
    x_atd_abertos_agora: abertos,
    x_atd_total: m ? n(m.total) : null,
    x_atd_resolvidos: m
      ? resolvidosAtendimento({ total: n(m.total) ?? 0, resolvidos: n(m.resolvidos) ?? 0, encerradosSemResolucao: n(m.encerrados_sem_resolucao) ?? 0 })
      : null,
    x_atd_1a_resposta_min: m ? n(m.primeira_resposta_media_min) : null,
  };
}
