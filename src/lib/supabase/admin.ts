import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com SERVICE ROLE — uso ESTRITO no servidor.
 *
 * Existe por um único motivo legítimo: emitir a URL ASSINADA de uma foto de
 * perfil guardada em bucket PRIVADO para quem TEM DIREITO de vê-la (a decisão
 * é sempre `podeVerAvatar`, aplicada ANTES de chamar isto). O bucket é privado
 * de propósito — a foto do inquilino não pode vazar — então o visitante público
 * não consegue gerar a URL sozinho; o servidor gera, e só depois da checagem.
 *
 * Retorna `null` quando `SUPABASE_SERVICE_ROLE_KEY` não está configurada
 * (sandbox/local/demo): nesse caso a foto simplesmente não aparece e a UI cai
 * para as iniciais — nunca quebra.
 *
 * NUNCA importe isto em componente client. NUNCA devolva o client ao browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export { AVATARS_BUCKET } from "@/lib/avatar-image";
/** Validade da URL assinada da foto (curta; a foto muda pouco). */
export const AVATAR_SIGNED_TTL = 60 * 30; // 30 min
