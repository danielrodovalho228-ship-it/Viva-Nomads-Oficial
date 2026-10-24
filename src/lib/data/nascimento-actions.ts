"use server";

import { createClient } from "@/lib/supabase/server";
import { nascimentoParaTela, validarNascimento } from "@/lib/conta/nascimento";

/*
  A4 — Conta › Meus dados (mockup perfil-04): a data de nascimento da PRÓPRIA pessoa.
  Sem migração (a Pista A não cria): fica nos dados da conta (user_metadata.data_nascimento, "aaaa-mm-dd"), que só a
  própria pessoa e a equipe leem. Quando a Pista B criar profiles.data_nascimento, troca-se a leitura e a gravação aqui.
*/

export async function getNascimento(): Promise<string> {
  const supabase = await createClient();
  if (!supabase) return "";
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return nascimentoParaTela((user?.user_metadata as { data_nascimento?: string } | undefined)?.data_nascimento);
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
  const { error } = await supabase.auth.updateUser({ data: { data_nascimento: r.iso } });
  if (error) return { ok: false, error: "Não foi possível salvar agora. Tente de novo." };
  return { ok: true };
}
