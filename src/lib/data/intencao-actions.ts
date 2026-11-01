"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { gravarIntencao } from "@/lib/data/intencao-servidor";
import { normalizarIntencoes, type Intencao } from "@/lib/auth/entrada";

/**
 * Prompt 49 — intenção (profiles.intencao): camada, não papel. Grava a intenção e, SÓ no primeiro acesso (intenção
 * e papel ativo ainda vazios), o papel inicial que ela aponta. PAPEL-B: depois disso, mudar a intenção na Conta não
 * troca o papel ativo (a troca é explícita: selo do topo ou "Usar este"). Nunca toca em role nem em permissão.
 * RLS: só o próprio perfil (update da coluna liberado na 0214).
 */

/** null = ainda não respondeu; [] = "Agora não". */
export async function getMinhaIntencao(): Promise<Intencao[] | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  // Achado 58: a falha de leitura LANÇA — antes virava "ainda não respondeu"/"nada marcado", e um toque ou "Salvar"
  // gravava só a opção escolhida por cima das outras.
  const { data, error } = await supabase.from("profiles").select("intencao").eq("id", user.id).maybeSingle();
  if (error) throw new Error("Não foi possível ler sua intenção agora.");
  const v = (data as { intencao?: unknown } | null)?.intencao;
  return v == null ? null : normalizarIntencoes(v);
}

export async function salvarMinhaIntencao(bruto: unknown, modo: "owner" | "tenant" | null): Promise<{ ok: boolean; error?: string; papelAplicado?: "owner" | "tenant" | null }> {
  const intencao = normalizarIntencoes(bruto);
  const supabase = await createClient();
  if (!supabase) return { ok: true }; // demo/preview: sem servidor
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada. Entre de novo." };
  const r = await gravarIntencao(supabase, user.id, intencao, modo);
  if (!r.ok) return { ok: false, error: "Não foi possível salvar agora." };
  revalidatePath("/dashboard/conta");
  return { ok: true, papelAplicado: r.papelAplicado };
}
