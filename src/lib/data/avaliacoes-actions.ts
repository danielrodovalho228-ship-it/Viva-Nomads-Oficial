"use server";

import { createClient } from "@/lib/supabase/server";
import { validarAvaliacao } from "@/lib/avaliacoes";

type ActionResult = { ok: boolean; demo?: boolean; error?: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AvaliacaoInput {
  contratoId: string;
  alvoId: string;
  papelAutor: "proprietario" | "inquilino";
  rating: number;
  comentario?: string;
}

/**
 * Registra a avaliação da OUTRA parte de um contrato. RLS garante autor_id =
 * quem chama; a unicidade (contrato, autor) impede duplicar. Best-effort:
 * no-op em demo/sem sessão/ids não-UUID.
 */
export async function avaliar(input: AvaliacaoInput): Promise<ActionResult> {
  const err = validarAvaliacao(input.rating, input.comentario);
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para avaliar." };
  if (!UUID_RE.test(input.contratoId) || !UUID_RE.test(input.alvoId))
    return { ok: true, demo: true };

  const { error } = await supabase.from("avaliacoes").insert({
    contrato_id: input.contratoId,
    autor_id: user.id,
    alvo_id: input.alvoId,
    papel_autor: input.papelAutor,
    rating: Math.round(input.rating),
    comentario: input.comentario?.trim() || null,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Você já avaliou esta pessoa." };
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export interface Reputacao {
  media: number;
  n: number;
}

/** Reputação (média + quantidade) de uma pessoa. {0,0} em demo/sem backend. */
export async function getReputacao(userId: string): Promise<Reputacao> {
  const supabase = await createClient();
  if (!supabase || !UUID_RE.test(userId)) return { media: 0, n: 0 };
  const { data } = await supabase.from("avaliacoes").select("rating").eq("alvo_id", userId);
  const notas = (data ?? []).map((r) => Number(r.rating));
  if (notas.length === 0) return { media: 0, n: 0 };
  const soma = notas.reduce((s, n) => s + n, 0);
  return { media: Math.round((soma / notas.length) * 10) / 10, n: notas.length };
}

/** IDs de contratos que EU já avaliei (para esconder o formulário). */
export async function meusContratosAvaliados(): Promise<string[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("avaliacoes")
    .select("contrato_id")
    .eq("autor_id", user.id);
  return (data ?? []).map((r) => String(r.contrato_id)).filter(Boolean);
}
