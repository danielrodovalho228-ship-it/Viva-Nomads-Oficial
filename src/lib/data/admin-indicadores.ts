import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/data/admin-guard";
import { chaveCidade } from "@/lib/cidades";
import {
  EVENTOS_HOME,
  resumoCandidaturas,
  type TipoEventoHome,
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
  /** Conta de teste ou anúncio [TESTE…] (só aparece com o filtro "teste"). */
  teste: boolean;
  /** Data do aceite da candidatura (a taxa foi gravada nesse dia) — para o rótulo único rotuloBaseTaxa. */
  aceiteEm: string | null;
  /** Candidatura do contrato (a cobrança da taxa é por candidatura). */
  leadId: string | null;
  plano: string | null;
}

/**
 * Contratos (reais) criados no período — a mesma lista para o Financeiro, a home e /admin/contratos.
 * Sem período: todos.
 */
export async function contratosReais(
  admin: Admin,
  periodo?: { ini: string; fim: string },
  cidade?: string | null,
  tipo: "real" | "teste" | "todos" = "real"
): Promise<ContratoLinhaAdmin[]> {
  const k = cidade ? chaveCidade(cidade) : null;
  let q = admin
    .from("contratos")
    .select("id, created_at, status, property_id, tenant_id, aluguel_mensal, prazo_total_dias, comissao_valor, comissao_percent, assinado_proprietario_em, assinado_inquilino_em, lead_id, owner_plan, properties!inner(owner_id, title, city), leads(accepted_at)")
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
    lead_id: string | null;
    owner_plan: string | null;
    properties: { owner_id: string; title: string | null; city: string | null };
    leads: { accepted_at: string | null } | null;
  }[])
    .map((c) => ({ ...c, ehTeste: teste.has(c.tenant_id) || teste.has(c.properties.owner_id) || MARCA_TESTE.test(c.properties.title ?? "") }))
    .filter((c) => (tipo === "todos" ? true : tipo === "teste" ? c.ehTeste : !c.ehTeste))
    .filter((c) => !k || chaveCidade(c.properties.city) === k)
    .map((c) => ({
      teste: c.ehTeste,
      aceiteEm: c.leads?.accepted_at ?? null,
      leadId: c.lead_id,
      plano: c.owner_plan,
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
  cidade?: string | null,
  tipo: "real" | "teste" | "todos" = "real"
): Promise<(PedidoParaMetrica & { id: string; compativeis: number })[]> {
  const k = cidade ? chaveCidade(cidade) : null;
  const [{ data: pedidos }, teste] = await Promise.all([
    admin.from("pedidos_moradia").select("id, inquilino_id, criado_em, cidade, compativeis_ao_publicar").gte("criado_em", periodo.ini).lt("criado_em", periodo.fim).limit(5000),
    idsContasTeste(admin),
  ]);
  const doRecorte = ((pedidos ?? []) as { id: string; inquilino_id: string; criado_em: string; cidade: string | null; compativeis_ao_publicar: number | null }[]).filter(
    (p) => (tipo === "todos" ? true : tipo === "teste" ? teste.has(p.inquilino_id) : !teste.has(p.inquilino_id)) && (!k || chaveCidade(p.cidade) === k)
  );
  if (!doRecorte.length) return [];
  const { data: resp } = await admin.from("respostas_pedido").select("pedido_id, criado_em").in("pedido_id", doRecorte.map((p) => p.id)).order("criado_em", { ascending: true });
  const primeira = new Map<string, string>();
  for (const r of (resp ?? []) as { pedido_id: string; criado_em: string }[]) if (!primeira.has(r.pedido_id)) primeira.set(r.pedido_id, r.criado_em);
  return doRecorte.map((p) => ({ id: p.id, criadoEm: p.criado_em, primeiraRespostaEm: primeira.get(p.id) ?? null, compativeis: Number(p.compativeis_ao_publicar ?? 0) }));
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

/** "Aguardando o seu OK" = cartões de aprovação pendentes e no prazo. O selo da barra lateral mostra SÓ isto. */
export async function contarAguardandoOk(cliente: Admin): Promise<number> {
  const { count } = await cliente.from("aprovacoes").select("id", { count: "exact", head: true }).eq("status", "pendente").gt("expira_em", new Date().toISOString());
  return count ?? 0;
}

/** Agentes: os três números com nome (item 10). */
export async function contadoresAgentes(admin: Admin): Promise<{ aguardandoOk: number; ordensPendentes: number; ordensLidas: number }> {
  const conta = async (p: PromiseLike<{ count: number | null }>) => (await p).count ?? 0;
  const [aguardandoOk, ordensPendentes, ordensLidas] = await Promise.all([
    contarAguardandoOk(admin),
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
  const [contratos, pedidos, solicitacoes, candidaturas, eventos] = await Promise.all([
    contratosReais(admin, periodo, cidade),
    pedidosParaMetrica(admin, periodo, cidade),
    solicitacoesManutencao(admin, periodo, cidade),
    candidaturasDoPeriodo(admin, periodo, cidade),
    eventosDoPeriodo(admin, periodo, cidade, Object.keys(EVENTOS_HOME)),
  ]);
  const ag = agregarContratos(contratos);
  const pr = respostaPedidos(pedidos);
  const cand = resumoCandidaturas(candidaturas);
  const ev = (t: TipoEventoHome) => eventos.filter((e) => e.tipo === t).length;
  return {
    x_candidaturas: cand.total,
    x_cand_decididas: cand.decididas,
    x_cand_aceitas: cand.aceitas,
    x_cand_mediana_h: cand.medianaHoras,
    x_ev_busca: ev("busca"),
    x_ev_ver_anuncio: ev("ver_anuncio"),
    x_ev_iniciar_candidatura: ev("iniciar_candidatura"),
    x_ev_iniciar_cadastro: ev("iniciar_cadastro"),
    x_ev_concluir_cadastro: ev("concluir_cadastro"),
    x_ev_iniciar_anuncio: ev("iniciar_anuncio"),
    x_ev_publicar_anuncio: ev("publicar_anuncio"),
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

export interface ImovelLinhaAdmin {
  id: string;
  titulo: string;
  ownerId: string;
  dono: string;
  status: string;
  cidade: string | null;
  bairro: string | null;
  criadoEm: string;
  documento: string;
  qualidade: string | null;
  donoTeste: boolean;
}

/** Imóveis do banco para /admin/imoveis (todos: reais e de teste — o tipo sai de tipoImovel). */
export async function imoveisDoBanco(admin: Admin): Promise<ImovelLinhaAdmin[]> {
  const [{ data }, teste] = await Promise.all([
    admin
      .from("properties")
      .select("id, title, owner_id, status, city, address, created_at, listing_quality_tier")
      .order("created_at", { ascending: false })
      .limit(3000),
    idsContasTeste(admin),
  ]);
  const linhas = (data ?? []) as {
    id: string;
    title: string | null;
    owner_id: string;
    status: string;
    city: string | null;
    address: string | null;
    created_at: string;
    listing_quality_tier: string | null;
  }[];
  if (!linhas.length) return [];
  const ids = linhas.map((p) => p.id);
  const donos = [...new Set(linhas.map((p) => p.owner_id))];
  const [{ data: perfis }, { data: docs }] = await Promise.all([
    admin.from("profiles").select("id, full_name").in("id", donos),
    admin.from("qualification_checklists").select("property_id, document_status").in("property_id", ids),
  ]);
  const nome = new Map(((perfis ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, nomeCurtoAdmin(p.full_name)]));
  const doc = new Map<string, string>();
  for (const d of (docs ?? []) as { property_id: string; document_status: string | null }[]) {
    const atual = doc.get(d.property_id);
    // "pending" (em revisão) ganha de tudo: é o que o filtro "documento em revisão" procura.
    if (!atual || d.document_status === "pending") doc.set(d.property_id, d.document_status ?? "none");
  }
  return linhas.map((p) => ({
    id: p.id,
    titulo: p.title ?? "Imóvel",
    ownerId: p.owner_id,
    dono: nome.get(p.owner_id) ?? "—",
    status: p.status,
    cidade: p.city,
    bairro: p.address,
    criadoEm: p.created_at,
    documento: doc.get(p.id) ?? "none",
    qualidade: p.listing_quality_tier,
    donoTeste: teste.has(p.owner_id),
  }));
}

/** "Ana S." — nome curto para as listas do admin. */
export function nomeCurtoAdmin(nome: string | null | undefined): string {
  const partes = String(nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "Sem nome";
  return partes.length === 1 ? partes[0] : `${partes[0]} ${partes[partes.length - 1][0]}.`;
}

/** Nomes curtos por id (partes de contrato, donos). */
export async function nomesCurtos(admin: Admin, ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const { data } = await admin.from("profiles").select("id, full_name").in("id", [...new Set(ids)]);
  return new Map(((data ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, nomeCurtoAdmin(p.full_name)]));
}

/** Cliente de serviço só depois de conferir que quem pede é admin (as páginas novas do admin). */
export async function adminDaPagina(): Promise<Admin | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await ehAdmin(supabase, user.id))) return null;
  return createAdminClient();
}

// ── Complemento do P29 (item 4): toda a home com lista — candidaturas, eventos e as filas do "Precisa de você" ─────

export interface CandidaturaAdmin {
  id: string;
  criadoEm: string;
  imovel: string;
  cidade: string | null;
  status: string;
  aceitaEm: string | null;
  recusadaEm: string | null;
}

type LinhaLead = {
  id: string;
  created_at: string;
  accepted_at: string | null;
  rejected_at: string | null;
  status: string | null;
  tenant_id: string;
  properties: { owner_id: string; title: string | null; city: string | null };
};

const paraCandidatura = (l: LinhaLead): CandidaturaAdmin => ({
  id: l.id,
  criadoEm: l.created_at,
  imovel: l.properties.title ?? "Imóvel",
  cidade: l.properties.city,
  status: l.status ?? "",
  aceitaEm: l.accepted_at,
  recusadaEm: l.rejected_at,
});

/** Candidaturas do período (imóvel real, inquilino real, cidade do imóvel) — a mesma regra da 0181 (leads_p). */
export async function candidaturasDoPeriodo(admin: Admin, periodo: { ini: string; fim: string }, cidade?: string | null): Promise<CandidaturaAdmin[]> {
  const k = cidade ? chaveCidade(cidade) : null;
  const [{ data }, teste] = await Promise.all([
    admin
      .from("leads")
      .select("id, created_at, accepted_at, rejected_at, status, tenant_id, properties!inner(owner_id, title, city)")
      .gte("created_at", periodo.ini)
      .lt("created_at", periodo.fim)
      .order("created_at", { ascending: false })
      .limit(5000),
    idsContasTeste(admin),
  ]);
  return ((data ?? []) as unknown as LinhaLead[])
    .filter((l) => !teste.has(l.tenant_id) && !teste.has(l.properties.owner_id) && !MARCA_TESTE.test(l.properties.title ?? ""))
    .filter((l) => !k || chaveCidade(l.properties.city) === k)
    .map(paraCandidatura);
}

/** "Candidaturas sem resposta há mais de 48 h" — a fila do "Precisa de você agora" (mesma regra da 0181). */
export async function candidaturasSemResposta48h(admin: Admin): Promise<CandidaturaAdmin[]> {
  const limite = new Date(Date.now() - 48 * 3_600_000).toISOString();
  const [{ data }, teste] = await Promise.all([
    admin
      .from("leads")
      .select("id, created_at, accepted_at, rejected_at, status, tenant_id, properties!inner(owner_id, title, city)")
      .is("accepted_at", null)
      .is("rejected_at", null)
      .lt("created_at", limite)
      .order("created_at", { ascending: true })
      .limit(2000),
    idsContasTeste(admin),
  ]);
  const fechados = new Set(["accepted", "rejected", "cancelled", "canceled", "expired"]);
  return ((data ?? []) as unknown as LinhaLead[])
    .filter((l) => !fechados.has(String(l.status ?? "")))
    .filter((l) => !teste.has(l.tenant_id) && !teste.has(l.properties.owner_id) && !MARCA_TESTE.test(l.properties.title ?? ""))
    .map(paraCandidatura);
}

/** Eventos anônimos do período por tipo (contas de teste fora; cidade pela chave do evento) — a mesma regra da 0181. */
export async function eventosDoPeriodo(
  admin: Admin,
  periodo: { ini: string; fim: string },
  cidade: string | null | undefined,
  tipos: readonly string[]
): Promise<{ tipo: string; criadoEm: string }[]> {
  const k = cidade ? chaveCidade(cidade) : null;
  let q = admin.from("eventos").select("tipo, criado_em, usuario_id, cidade_chave").in("tipo", [...tipos]).gte("criado_em", periodo.ini).lt("criado_em", periodo.fim).limit(50000);
  if (k) q = q.eq("cidade_chave", k);
  const [{ data }, teste] = await Promise.all([q, idsContasTeste(admin)]);
  return ((data ?? []) as { tipo: string; criado_em: string; usuario_id: string | null }[])
    .filter((e) => !e.usuario_id || !teste.has(e.usuario_id))
    .map((e) => ({ tipo: e.tipo, criadoEm: e.criado_em }));
}

/** "Chamados urgentes sem resposta há mais de 4 h" (manutenção) — mesma regra da 0181. */
export async function urgentesSemResposta4h(admin: Admin) {
  const limite = new Date(Date.now() - 4 * 3_600_000).toISOString();
  const { data } = await admin
    .from("service_orders")
    .select("id, category, priority, status, opened_at, first_response_at, resolved_at, simulacao, properties!inner(owner_id, title, city)")
    .eq("priority", "urgente")
    .neq("status", "resolvido")
    .is("first_response_at", null)
    .lt("opened_at", limite)
    .order("opened_at", { ascending: true })
    .limit(2000);
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
  }[]).filter((s) => !s.simulacao);
}

/** "Taxas vencidas": cobranças da taxa de serviço com status vencido, pelo recorte Real/Teste/Todos do contrato. */
export async function taxasVencidas(admin: Admin, tipo: "real" | "teste" | "todos" = "real"): Promise<{ leadId: string; criadoEm: string }[]> {
  const { data } = await admin.from("cobrancas_fechamento").select("lead_id, criado_em").eq("tipo", "comissao").eq("status", "vencido").limit(2000);
  const linhas = (data ?? []) as { lead_id: string; criado_em: string }[];
  if (!linhas.length || tipo === "todos") return linhas.map((l) => ({ leadId: l.lead_id, criadoEm: l.criado_em }));
  const testeDoLead = await leadsDeTeste(admin, linhas.map((l) => l.lead_id));
  return linhas.filter((l) => (tipo === "teste") === testeDoLead.has(l.lead_id)).map((l) => ({ leadId: l.lead_id, criadoEm: l.criado_em }));
}

/** Título do imóvel de cada candidatura (para listar as taxas vencidas sem dado pessoal). */
export async function imovelDosLeads(admin: Admin, ids: string[]): Promise<Map<string, string>> {
  const u = [...new Set(ids.filter(Boolean))];
  if (!u.length) return new Map();
  const { data } = await admin.from("leads").select("id, properties!inner(title)").in("id", u);
  return new Map(((data ?? []) as unknown as { id: string; properties: { title: string | null } }[]).map((l) => [l.id, l.properties.title ?? "Imóvel"]));
}

/** Cobrança da taxa de cada candidatura (status e pagamento) — para a tabela do Financeiro. */
export async function cobrancasTaxa(admin: Admin, leadIds: string[]): Promise<Map<string, { status: string; pagoEm: string | null }>> {
  const ids = [...new Set(leadIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const { data } = await admin.from("cobrancas_fechamento").select("lead_id, status, pago_em").eq("tipo", "comissao").in("lead_id", ids);
  return new Map(((data ?? []) as { lead_id: string; status: string; pago_em: string | null }[]).map((c) => [c.lead_id, { status: c.status, pagoEm: c.pago_em }]));
}

/** Candidaturas (leads) que são de teste: conta de teste em qualquer lado ou anúncio [TESTE…]. */
export async function leadsDeTeste(admin: Admin, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const [{ data }, teste] = await Promise.all([
    admin.from("leads").select("id, tenant_id, properties!inner(owner_id, title)").in("id", [...new Set(ids)]),
    idsContasTeste(admin),
  ]);
  return new Set(
    ((data ?? []) as unknown as { id: string; tenant_id: string; properties: { owner_id: string; title: string | null } }[])
      .filter((l) => teste.has(l.tenant_id) || teste.has(l.properties.owner_id) || MARCA_TESTE.test(l.properties.title ?? ""))
      .map((l) => l.id)
  );
}

/** "Pedidos expirando sem nenhuma resposta" (ativos, vencem em até 3 dias) — mesma regra da 0181. */
export async function pedidosExpirandoSemResposta(admin: Admin): Promise<string[]> {
  const limite = new Date(Date.now() + 3 * 86_400_000).toISOString();
  const [{ data }, teste] = await Promise.all([
    admin.from("pedidos_moradia").select("id, inquilino_id").eq("status", "ativo").lt("expira_em", limite).limit(2000),
    idsContasTeste(admin),
  ]);
  const ativos = ((data ?? []) as { id: string; inquilino_id: string }[]).filter((p) => !teste.has(p.inquilino_id));
  if (!ativos.length) return [];
  const { data: resp } = await admin.from("respostas_pedido").select("pedido_id").in("pedido_id", ativos.map((p) => p.id));
  const com = new Set(((resp ?? []) as { pedido_id: string }[]).map((r) => r.pedido_id));
  return ativos.filter((p) => !com.has(p.id)).map((p) => p.id);
}
