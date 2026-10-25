"use server";

import { createClient } from "@/lib/supabase/server";
import { nascimentoParaTela, validarNascimento } from "@/lib/conta/nascimento";

/*
  A4 — Conta › Meus dados (mockup perfil-04): a data de nascimento da PRÓPRIA pessoa.
  Fica em profiles.data_nascimento (0237), que só a própria pessoa lê e grava (RLS do perfil + grant de coluna).
  Antes da 0237 a tela guardava em user_metadata.data_nascimento: a migração copiou o que havia, e salvar limpa a cópia
  antiga para o dado não ficar em dois lugares.
*/

export async function getNascimento(): Promise<string> {
  const supabase = await createClient();
  if (!supabase) return "";
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "";
  const { data } = await supabase.from("profiles").select("data_nascimento").eq("id", user.id).maybeSingle();
  return nascimentoParaTela((data as { data_nascimento?: string | null } | null)?.data_nascimento);
}

export async function salvarNascimento(v: string): Promise<{ ok: boolean; demo?: boolean; error?: string }> {
  const r = validarNascimento(String(v ?? ""));
  if (!r.ok) return { ok: false, error: r.erro };
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para alterar seus dados." };
  const { error } = await supabase.from("profiles").update({ data_nascimento: r.iso }).eq("id", user.id);
  if (error) return { ok: false, error: "Não foi possível salvar agora. Tente de novo." };
  if ((user.user_metadata as { data_nascimento?: unknown } | undefined)?.data_nascimento !== undefined) {
    await supabase.auth.updateUser({ data: { data_nascimento: null } }).catch(() => null);
  }
  return { ok: true };
}
