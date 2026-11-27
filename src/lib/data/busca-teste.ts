import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * E571 (decisão do Daniel, 04/11/2026): quem busca é uma conta de TESTE logada (profiles.is_teste, que só o servidor
 * liga)? Então a busca inclui os anúncios de teste ativos — o QA prova os filtros (ex.: "Aceita negociação") pelo lado
 * do morador. Visitante, conta real, admin sem marca de teste ou qualquer falha: false (nada muda, nada vaza).
 */
export async function buscaComAnunciosDeTeste(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();
    if (!supabase || !admin) return false;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { data, error } = await admin.from("profiles").select("is_teste").eq("id", user.id).maybeSingle();
    if (error) return false;
    return (data as { is_teste: boolean | null } | null)?.is_teste === true;
  } catch {
    return false;
  }
}
