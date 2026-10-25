import "server-only";
/*
  E174-B — quem destas contas tem o vínculo profissional CONFIRMADO, e com qual domínio (para o perfil público, a
  candidatura, a conversa, a proposta e as avaliações). Lê com a chave de serviço só `dominio` das linhas confirmadas:
  nunca o código, o e-mail ou as tentativas. Sem banco ou com erro: ninguém tem o selo.
*/
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { seloVinculoPublico } from "./textos";

export async function vinculosConfirmados(userIds: (string | null | undefined)[], admin: SupabaseClient | null = createAdminClient()): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  const ids = [...new Set(userIds.filter((x): x is string => !!x))];
  if (!admin || ids.length === 0) return m;
  try {
    const { data } = await admin.from("vinculo_profissional").select("user_id, dominio").in("user_id", ids).not("confirmado_em", "is", null);
    for (const r of (data ?? []) as { user_id: string; dominio: string }[]) if (seloVinculoPublico(r.dominio)) m.set(r.user_id, r.dominio);
  } catch {
    /* sem o selo */
  }
  return m;
}
