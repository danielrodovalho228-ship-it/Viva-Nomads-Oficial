"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase para o navegador — SINGLETON.
 *
 * IMPORTANTE: precisa ser uma ÚNICA instância por aba. O GoTrue (auth) usa o
 * `navigator.locks` para serializar o refresh do token; criar um novo cliente a
 * cada chamada (AuthProvider, /auth, /conta…) faz várias instâncias disputarem o
 * mesmo lock e o `signInWithPassword` pode ficar PENDURADO para sempre (o botão
 * "gira" mesmo com o servidor respondendo 200). Memorizar a instância elimina o
 * deadlock.
 */
let browserClient: SupabaseClient | null = null;

export function createClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!browserClient) browserClient = createBrowserClient(url, key);
  return browserClient;
}

export const isSupabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
