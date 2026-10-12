import type { SupabaseClient } from "@supabase/supabase-js";
import { decidirPortaoMfa, mfaAdminObrigatoria } from "../admin/mfa.ts";

/**
 * A sessão está em AAL2 (passou pelo código do app autenticador)? Helper único
 * para server actions do admin (ordem f7817f00). Falha FECHADA: erro ao consultar = não.
 */
export async function sessaoAal2(supabase: SupabaseClient): Promise<boolean> {
  if (!mfaAdminObrigatoria()) return true;
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) return false;
    return decidirPortaoMfa(data.currentLevel, data.nextLevel) === "liberar";
  } catch {
    return false;
  }
}

/**
 * O usuário logado é ADMIN com verificação em duas etapas concluída (AAL2)?
 * Papel lido do PRÓPRIO perfil (a RLS deixa ler o próprio). Só vale com a 0052
 * aplicada. Admin em sessão só com senha (aal1) NÃO passa: server actions do admin
 * ficam fechadas até digitar o código.
 */
export async function ehAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if ((data?.role as string | undefined) !== "admin") return false;
  return sessaoAal2(supabase);
}

/** Alias explícito para quem quer deixar claro que exige AAL2. */
export const exigirAdminAal2 = ehAdmin;
