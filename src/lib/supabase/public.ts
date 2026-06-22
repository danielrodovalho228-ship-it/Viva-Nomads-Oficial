import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase PÚBLICO (anônimo) para leituras que não dependem de sessão:
 * imóveis ativos, listagens, detalhe público. Diferente do cliente de servidor,
 * NÃO lê cookies — então não força renderização dinâmica (`cookies()` em rota
 * estaticamente otimizada dispara DYNAMIC_SERVER_USAGE → 500). A RLS continua
 * valendo no papel `anon` (só lê o que é público).
 *
 * Retorna `null` sem as variáveis configuradas (modo demonstração).
 */
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}
