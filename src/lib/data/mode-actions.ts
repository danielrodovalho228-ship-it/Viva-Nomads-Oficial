"use server";

import { createClient } from "@/lib/supabase/server";
import type { ViewMode } from "@/lib/store";

/**
 * Modo ativo (proprietário ⇄ inquilino) como PREFERÊNCIA DE PERFIL (B1).
 *
 * O seletor do topo grava aqui; o AuthProvider lê aqui no login. Assim a escolha
 * do mundo sobrevive a refresh, deep-link e nova aba — inclusive em outro
 * dispositivo. No-op fail-safe quando não há Supabase (build de demonstração):
 * o localStorage do zustand continua sendo a verdade local.
 */

/** Grava o modo preferido no perfil do próprio usuário. */
export async function setPreferredMode(mode: ViewMode): Promise<{ ok: boolean }> {
  if (mode !== "owner" && mode !== "tenant") return { ok: false };
  const supabase = await createClient();
  if (!supabase) return { ok: true }; // demo/preview: sem servidor, sem escrita
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase
    .from("profiles")
    .update({ preferred_mode: mode })
    .eq("id", user.id);
  return { ok: !error };
}

/**
 * Resolve o modo INICIAL da sessão NO SERVIDOR (reteste QA item 1), nesta ordem:
 *   (a) última preferência salva no perfil (`preferred_mode`);
 *   (b) papel da conta — admin/proprietário, OU proprietário com imóvel → owner;
 *       inquilino → tenant;
 *   (c) conta nova sem papel definido → null (dispara a pergunta de 1º acesso).
 * Assim, deep-link em aba nova nunca cai em Inquilino por padrão para quem é
 * proprietário. null em demo/preview (sem Supabase) — o cliente decide.
 */
export async function resolveInitialMode(): Promise<ViewMode | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_mode, role")
    .eq("id", user.id)
    .maybeSingle();

  // (a) preferência salva vence sempre.
  const pm = profile?.preferred_mode;
  if (pm === "owner" || pm === "tenant") return pm;

  // (b) papel da conta.
  const role = profile?.role;
  if (role === "admin" || role === "owner") return "owner";

  // (b) proprietário "de fato": tem ao menos um imóvel cadastrado.
  const { count } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);
  if ((count ?? 0) > 0) return "owner";

  if (role === "tenant") return "tenant";

  // (c) conta nova sem papel → deixa a pergunta de primeiro acesso decidir.
  return null;
}

/** Lê o modo preferido do perfil. null = sem escolha (deriva do papel). */
export async function getPreferredMode(): Promise<ViewMode | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("preferred_mode")
    .eq("id", user.id)
    .maybeSingle();
  const m = data?.preferred_mode;
  return m === "owner" || m === "tenant" ? m : null;
}
