"use server";

import { createClient } from "@/lib/supabase/server";
import { CHAVES_PRIVACIDADE, normalizarPrivacidade, type Privacidade } from "@/lib/conta/tela-privacidade";

/*
  A5 — Conta › Privacidade (mockup perfil-05): as três chaves da PRÓPRIA pessoa, em user_metadata.privacidade (sem
  migração: a Pista A não cria). Grava só a preferência; o efeito no produto espera a regra (ver tela-privacidade.ts).
*/

export async function getPrivacidade(): Promise<Privacidade> {
  const supabase = await createClient();
  if (!supabase) return normalizarPrivacidade(null);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return normalizarPrivacidade((user?.user_metadata as { privacidade?: unknown } | undefined)?.privacidade);
}

export async function setPrivacidade(bruto: unknown): Promise<{ ok: boolean; demo?: boolean; error?: string }> {
  const b = bruto as Partial<Record<string, unknown>> | null;
  if (!b || CHAVES_PRIVACIDADE.some((c) => typeof b[c.chave] !== "boolean")) return { ok: false, error: "Valor inválido." };
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para alterar suas permissões." };
  const { error } = await supabase.auth.updateUser({ data: { privacidade: normalizarPrivacidade(b) } });
  if (error) return { ok: false, error: "Não foi possível salvar agora. Tente de novo." };
  return { ok: true };
}
