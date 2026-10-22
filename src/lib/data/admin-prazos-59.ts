import "server-only";
/*
  Prompt 59 — leituras do admin: manutenção fora do prazo de solução, contestações do padrão mínimo e a taxa de solução
  no prazo por proprietário. A mesma função conta a fila do início do /admin e monta a lista que ela abre.
  Sem simulações e sem contas de teste nas contagens do admin (a regra das outras filas).
*/
import type { SupabaseClient } from "@supabase/supabase-js";
import { estadoSolucao, taxaSolucaoNoPrazo, type OrdemSolucao } from "@/lib/manutencao-solucao";

type Admin = SupabaseClient;

const COLUNAS = "id, category, priority, status, description, opened_at, first_response_at, resolved_at, provisoria_em, solucao_marcada_em, reclassificacao_pedida_em, simulacao, properties!inner(owner_id, title, city)";

export interface OrdemAdmin {
  id: string;
  category: string | null;
  priority: OrdemSolucao["priority"];
  status: string;
  description: string;
  opened_at: string;
  first_response_at: string | null;
  resolved_at: string | null;
  provisoria_em: string | null;
  solucao_marcada_em: string | null;
  reclassificacao_pedida_em: string | null;
  simulacao: boolean | null;
  properties: { owner_id: string; title: string | null; city: string | null };
}

const solucao = (o: OrdemAdmin): OrdemSolucao => ({
  priority: o.priority,
  openedAt: o.opened_at,
  provisoriaEm: o.provisoria_em,
  solucaoMarcadaEm: o.solucao_marcada_em,
  resolvedAt: o.resolved_at,
  status: o.status,
});

async function contasTeste(admin: Admin): Promise<Set<string>> {
  const { data } = await admin.from("profiles").select("id").eq("is_teste", true).limit(5000);
  return new Set(((data ?? []) as { id: string }[]).map((p) => p.id));
}

/** "Manutenção fora do prazo": abertas cujo prazo de solução (ou a provisória, no urgente) venceu. Mais antiga primeiro. */
export async function manutencaoForaDoPrazo(admin: Admin, agora = new Date()): Promise<OrdemAdmin[]> {
  const [{ data }, teste] = await Promise.all([
    admin.from("service_orders").select(COLUNAS).neq("status", "resolvido").order("opened_at", { ascending: true }).limit(2000),
    contasTeste(admin),
  ]);
  return ((data ?? []) as unknown as OrdemAdmin[]).filter(
    (o) => !o.simulacao && !teste.has(o.properties.owner_id) && estadoSolucao(solucao(o), agora).estado === "vencido",
  );
}

/** Pedidos de reclassificação ainda sem decisão (a ordem continua aberta e com a prioridade original do pedido). */
export async function pedidosDeReclassificacao(admin: Admin): Promise<OrdemAdmin[]> {
  const { data } = await admin.from("service_orders").select(COLUNAS).not("reclassificacao_pedida_em", "is", null).is("reclassificada_em", null).neq("status", "resolvido").limit(500);
  return ((data ?? []) as unknown as OrdemAdmin[]).filter((o) => !o.simulacao);
}

export interface ContestacaoAdmin {
  id: string;
  chave: string;
  contrato_id: string | null;
  aberta_em: string;
  contestada_em: string | null;
  texto_morador: string | null;
  motivo_contestacao: string | null;
  properties: { title: string | null; owner_id: string };
}

/** Contestações do padrão mínimo esperando a decisão do atendimento (a mais antiga primeiro). */
export async function contestacoesConforto(admin: Admin): Promise<ContestacaoAdmin[]> {
  const { data, error } = await admin
    .from("conforto_pendencias")
    .select("id, chave, contrato_id, aberta_em, contestada_em, texto_morador, motivo_contestacao, properties!inner(title, owner_id)")
    .eq("status", "contestada")
    .order("contestada_em", { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as unknown as ContestacaoAdmin[];
}

/**
 * Taxa de solução no prazo por proprietário (12 meses): resolvidos no prazo ÷ resolvidos. Só aparece com 3 ou mais
 * resolvidos (taxaSolucaoNoPrazo devolve null abaixo disso).
 */
export async function taxasDeSolucaoDosDonos(admin: Admin, agora = new Date()): Promise<{ donoId: string; nome: string; taxa: number; noPrazo: number; resolvidos: number }[]> {
  const desde = new Date(agora.getTime() - 400 * 86_400_000).toISOString();
  const { data } = await admin.from("service_orders").select(COLUNAS).eq("status", "resolvido").gte("opened_at", desde).limit(5000);
  const porDono = new Map<string, OrdemSolucao[]>();
  for (const o of ((data ?? []) as unknown as OrdemAdmin[]).filter((x) => !x.simulacao)) {
    porDono.set(o.properties.owner_id, [...(porDono.get(o.properties.owner_id) ?? []), solucao(o)]);
  }
  const linhas = [...porDono.entries()].map(([donoId, ordens]) => ({ donoId, t: taxaSolucaoNoPrazo(ordens, agora) })).filter((x) => x.t);
  if (!linhas.length) return [];
  const { data: perfis } = await admin.from("profiles").select("id, full_name").in("id", linhas.map((l) => l.donoId));
  const nome = new Map(((perfis ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name ?? "Proprietário"]));
  return linhas
    .map((l) => ({ donoId: l.donoId, nome: nome.get(l.donoId) ?? "Proprietário", taxa: l.t!.taxa, noPrazo: l.t!.noPrazo, resolvidos: l.t!.resolvidos }))
    .sort((a, b) => a.taxa - b.taxa || b.resolvidos - a.resolvidos);
}
