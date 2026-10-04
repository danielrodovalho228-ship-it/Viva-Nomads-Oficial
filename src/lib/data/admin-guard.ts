import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * O usuário logado é ADMIN? Lido do PRÓPRIO perfil (a RLS deixa ler o próprio).
 * Só vale com a 0052 aplicada (antes dela, qualquer um conseguia gravar
 * role='admin' no próprio perfil). O banco reforça com is_admin() nas regras.
 */
export async function ehAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  return (data?.role as string | undefined) === "admin";
}
