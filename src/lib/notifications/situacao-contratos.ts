import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SituacaoDosContratos } from "./sino";

/** E1128: o pedido de avaliação tem visita por acontecer enquanto está escolhido ou agendado E tem data de visita. */
const STATUS_COM_VISITA_POR_ACONTECER = ["designado", "agendado"] as const;

/**
 * E1128: os pedidos de avaliação da pessoa (como dono, morador ou avaliador) com visita por acontecer, e os imóveis
 * deles. Lê com o cliente de serviço, SEMPRE filtrado pela própria pessoa. Falha de leitura: undefined (nada é escondido).
 */
async function avaliacaoComVisitaDe(userId: string): Promise<SituacaoDosContratos["avaliacaoComVisita"]> {
  const admin = createAdminClient();
  if (!admin) return undefined;
  const creds = await admin.from("avaliadores_credenciamento").select("id, parceiros!inner(user_id)").eq("parceiros.user_id", userId).limit(20);
  if (creds.error) return undefined;
  const meusCredenciamentos = ((creds.data ?? []) as { id: string }[]).map((c) => c.id);
  const base = () => admin.from("vistoria_pedidos").select("id, property_id").in("status", [...STATUS_COM_VISITA_POR_ACONTECER]).not("agendado_para", "is", null).limit(200);
  const [partes, comoAvaliador] = await Promise.all([
    base().or(`owner_id.eq.${userId},morador_id.eq.${userId}`),
    meusCredenciamentos.length ? base().in("avaliador_id", meusCredenciamentos) : Promise.resolve({ data: [], error: null }),
  ]);
  if (partes.error || comoAvaliador.error) return undefined;
  const linhas = [...((partes.data ?? []) as { id: string; property_id: string | null }[]), ...((comoAvaliador.data ?? []) as { id: string; property_id: string | null }[])];
  return { pedidos: new Set(linhas.map((l) => l.id)), imoveis: new Set(linhas.map((l) => (l.property_id ?? "").toLowerCase()).filter(Boolean)) };
}

/*
  E676 — a situação REAL dos contratos citados nos avisos críticos, lida com a sessão da pessoa (a RLS só mostra os
  contratos e aditivos em que ela é parte). Falha de leitura: null (a faixa não esconde nada).
*/
export async function situacaoDosContratos(userId: string, ids: readonly string[], opcoes: { visitas?: boolean; avaliacao?: boolean } = {}): Promise<SituacaoDosContratos | null> {
  const unicos = [...new Set(ids)].slice(0, 20);
  const supabase = await createClient();
  if (!supabase) return null;
  // E1060: as visitas do dono que ainda esperam resposta (o "Pedido de visita" só vale enquanto elas existem).
  let visitaPendente: Set<string> | undefined;
  if (opcoes.visitas) {
    const { data, error } = await supabase.from("visitas_video").select("id").eq("owner_id", userId).eq("status", "pedido").limit(200);
    if (!error) visitaPendente = new Set(((data ?? []) as { id: string }[]).map((v) => v.id));
  }
  // E1128: os pedidos de avaliação com visita por acontecer (o aviso da visita só vale enquanto eles existem).
  const avaliacaoComVisita = opcoes.avaliacao ? await avaliacaoComVisitaDe(userId).catch(() => undefined) : undefined;
  if (!unicos.length) return { assinarPendente: new Set(), aditivoAberto: new Set(), visitaPendente, avaliacaoComVisita };
  const [contratos, aditivos] = await Promise.all([
    supabase.from("contratos").select("id, status, tenant_id, assinado_inquilino_em, assinado_proprietario_em, properties(owner_id)").in("id", unicos),
    supabase.from("contrato_aditivos").select("contrato_id, expira_em").in("contrato_id", unicos).eq("status", "proposto"),
  ]);
  if (contratos.error || aditivos.error) return null;
  const assinarPendente = new Set<string>();
  for (const c of (contratos.data ?? []) as unknown as { id: string; status: string; tenant_id: string; assinado_inquilino_em: string | null; assinado_proprietario_em: string | null; properties: { owner_id: string | null } | { owner_id: string | null }[] | null }[]) {
    const dono = Array.isArray(c.properties) ? c.properties[0]?.owner_id : c.properties?.owner_id;
    const falta = (c.tenant_id === userId && !c.assinado_inquilino_em) || (dono === userId && !c.assinado_proprietario_em);
    if (c.status === "ativo" && falta) assinarPendente.add(c.id);
  }
  const agora = Date.now();
  const aditivoAberto = new Set<string>();
  for (const a of (aditivos.data ?? []) as { contrato_id: string; expira_em: string }[]) if (Date.parse(a.expira_em) > agora) aditivoAberto.add(a.contrato_id);
  return { assinarPendente, aditivoAberto, visitaPendente, avaliacaoComVisita };
}
