/**
 * Estado de configuração do ambiente.
 *
 * O "modo demonstração" não é uma flag manual: é a AUSÊNCIA do Supabase. Sem as
 * variáveis públicas do Supabase, a app roda 100% no cliente (sessão simulada,
 * dados de exemplo, mapa em placeholder) — útil para desenvolvimento e preview.
 * Com elas configuradas, o acesso real assume (login, RLS, permissões por papel).
 *
 * Fonte ÚNICA da verdade — não espalhar checagens de env soltas pelo código.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/** Verdadeiro quando NÃO há Supabase configurado (modo demonstração). */
export function isDemoMode(): boolean {
  return !isSupabaseConfigured();
}
