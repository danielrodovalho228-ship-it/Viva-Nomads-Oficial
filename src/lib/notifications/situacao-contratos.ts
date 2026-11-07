import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SituacaoDosContratos } from "./sino";

/*
  E676 — a situação REAL dos contratos citados nos avisos críticos, lida com a sessão da pessoa (a RLS só mostra os
  contratos e aditivos em que ela é parte). Falha de leitura: null (a faixa não esconde nada).
*/
export async function situacaoDosContratos(userId: string, ids: readonly string[]): Promise<SituacaoDosContratos | null> {
  const unicos = [...new Set(ids)].slice(0, 20);
  if (!unicos.length) return { assinarPendente: new Set(), aditivoAberto: new Set() };
  const supabase = await createClient();
  if (!supabase) return null;
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
  return { assinarPendente, aditivoAberto };
}
