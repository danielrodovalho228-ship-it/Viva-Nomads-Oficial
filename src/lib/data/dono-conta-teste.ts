import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * E786: o dono do anúncio é conta de teste (profiles.is_teste)? A mesma regra do E131 (vitrine e ranking). Lido no
 * servidor com o cliente de serviço — o visitante não lê o is_teste de outra pessoa. Falha na leitura → false (a página
 * abre normal; o título com a marca continua valendo).
 */
export const donoEhContaTeste = cache(async (ownerId: string | null | undefined): Promise<boolean> => {
  if (!ownerId) return false;
  const admin = createAdminClient();
  if (!admin) return false;
  const { data, error } = await admin.from("profiles").select("is_teste").eq("id", ownerId).maybeSingle();
  if (error) return false;
  return (data as { is_teste?: boolean } | null)?.is_teste === true;
});
