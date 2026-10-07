import "server-only";
import { AVATAR_SIGNED_TTL, AVATARS_BUCKET, createAdminClient } from "@/lib/supabase/admin";

/**
 * Foto do Daniel (dono) na Central de Agentes. É foto REAL de uma pessoa: fica
 * no bucket PRIVADO de avatares (o repositório é público, então ela não entra
 * no código nem em public/) e só sai como URL assinada curta, gerada no
 * servidor para a página /admin/agentes — cujo layout já exige admin.
 * Sem arquivo ou sem service role: null, e a tela mostra as iniciais.
 */
export const CAMINHO_FOTO_DONO = "equipe/daniel.webp";

export async function urlFotoDono(): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.storage.from(AVATARS_BUCKET).createSignedUrl(CAMINHO_FOTO_DONO, AVATAR_SIGNED_TTL);
  return error || !data?.signedUrl ? null : data.signedUrl;
}
