"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente Supabase para o navegador.
 * Retorna `null` quando as variáveis de ambiente ainda não foram configuradas,
 * permitindo que a UI rode em modo demonstração sem quebrar.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}

export const isSupabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
