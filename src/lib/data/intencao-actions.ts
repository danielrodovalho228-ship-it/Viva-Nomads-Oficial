"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizarIntencoes, type Intencao } from "@/lib/auth/entrada";

/**
 * Prompt 49 — intenção (profiles.intencao): camada, não papel. Grava SÓ a intenção e, quando ela aponta um lado,
 * a preferência de modo do painel (preferred_mode, a mesma do seletor do topo). Nunca toca em role nem em
 * permissão. RLS: só o próprio perfil (update da coluna liberado na 0214).
 */

/** null = ainda não respondeu; [] = "Agora não". */
export async function getMinhaIntencao(): Promise<Intencao[] | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("intencao").eq("id", user.id).maybeSingle();
  const v = (data as { intencao?: unknown } | null)?.intencao;
  return v == null ? null : normalizarIntencoes(v);
}

export async function salvarMinhaIntencao(bruto: unknown, modo: "owner" | "tenant" | null): Promise<{ ok: boolean; error?: string }> {
  const intencao = normalizarIntencoes(bruto);
  const supabase = await createClient();
  if (!supabase) return { ok: true }; // demo/preview: sem servidor
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada. Entre de novo." };
  const { error } = await supabase.from("profiles").update({ intencao }).eq("id", user.id);
  if (error) return { ok: false, error: "Não foi possível salvar agora." };
  if (modo === "owner" || modo === "tenant") {
    await supabase.from("profiles").update({ preferred_mode: modo }).eq("id", user.id);
  }
  revalidatePath("/dashboard/conta");
  return { ok: true };
}
