import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Registra uma ação de moderação no `moderacao_log` (quem, o quê, em quem,
 * quando, por quê). Grava pela sessão do admin (RLS `is_admin()`). Best-effort:
 * nunca derruba a ação que já foi gravada.
 */
export async function logModeracao(
  supabase: SupabaseClient,
  adminId: string,
  acao: string,
  alvoTipo: string,
  alvoId: string,
  motivo?: string | null
): Promise<void> {
  await supabase
    .from("moderacao_log")
    .insert({ admin_id: adminId, acao, alvo_tipo: alvoTipo, alvo_id: alvoId, motivo: motivo || null })
    .then(undefined, () => {});
}
