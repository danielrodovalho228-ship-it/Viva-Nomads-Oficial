import type { SupabaseClient } from "@supabase/supabase-js";
import { integracoesSimuladas } from "@/lib/integracoes";
import type { LaudoCafGravado } from "@/lib/documento/conferencia-matricula";
import { estadoIdentidadeDe, type EstadoIdentidade } from "@/lib/identidade/estado";

/**
 * Estado da identidade de uma pessoa, lido no SERVIDOR (cliente admin): o laudo mais recente + se a conta é de teste.
 * Fonte única (complemento do prompt 23). Sem "use server": função interna, nunca chamada do navegador.
 */
/** A leitura que falha LANÇA: "sem laudo" viraria "pendente"/"não verificada" por engano. Quem chama decide o que mostrar. */
export const MSG_IDENTIDADE_SEM_LEITURA = "Não foi possível conferir a identidade agora.";

export async function estadoIdentidade(admin: SupabaseClient, userId: string, agora = new Date()): Promise<EstadoIdentidade> {
  const [{ data: perfil, error: e1 }, { data: laudo, error: e2 }] = await Promise.all([
    admin.from("profiles").select("is_teste").eq("id", userId).maybeSingle(),
    admin
      .from("tenant_verifications")
      .select("caf_result, traffic_light, valid_until, created_at")
      .eq("tenant_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (e1 || e2) throw new Error(MSG_IDENTIDADE_SEM_LEITURA);
  return estadoIdentidadeDe((laudo as LaudoCafGravado | null) ?? null, perfil?.is_teste === true || integracoesSimuladas(), agora);
}

/** O mesmo para várias pessoas de uma vez (cartão do candidato, coluna do admin). */
export async function estadosIdentidade(admin: SupabaseClient, ids: string[], agora = new Date()): Promise<Map<string, EstadoIdentidade>> {
  const out = new Map<string, EstadoIdentidade>();
  if (!ids.length) return out;
  const [{ data: perfis, error: e1 }, { data: laudos, error: e2 }] = await Promise.all([
    admin.from("profiles").select("id, is_teste").in("id", ids),
    admin
      .from("tenant_verifications")
      .select("tenant_id, caf_result, traffic_light, valid_until, created_at")
      .in("tenant_id", ids)
      .order("created_at", { ascending: false }),
  ]);
  if (e1 || e2) throw new Error(MSG_IDENTIDADE_SEM_LEITURA);
  const teste = new Map(((perfis ?? []) as { id: string; is_teste: boolean | null }[]).map((p) => [p.id, p.is_teste === true]));
  const recente = new Map<string, LaudoCafGravado>();
  for (const l of (laudos ?? []) as (LaudoCafGravado & { tenant_id: string })[]) if (!recente.has(l.tenant_id)) recente.set(l.tenant_id, l);
  const sim = integracoesSimuladas();
  for (const id of ids) out.set(id, estadoIdentidadeDe(recente.get(id) ?? null, teste.get(id) === true || sim, agora));
  return out;
}
