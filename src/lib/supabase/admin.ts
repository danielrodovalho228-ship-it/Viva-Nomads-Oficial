import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com a chave de serviço (service role) — ignora RLS.
 * Use APENAS no servidor, em rotas sem usuário autenticado (ex.: webhooks de
 * gateway). Retorna `null` quando as variáveis ainda não foram configuradas.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
