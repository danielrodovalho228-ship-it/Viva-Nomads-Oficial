"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { contemContato } from "@/lib/pedidos/pedidos";
import {
  isCategoriaKey,
  CATEGORIA_NAO_INFORMAR,
  CATEGORIA_OUTRO_PREFIX,
  CATEGORIA_OUTRO_MAXLEN,
} from "@/config/categorias-profissionais";

type Result = { ok: boolean; error?: string };

/**
 * Normaliza o valor para o formato ARMAZENADO, com sanitização SERVIDOR do campo
 * livre "Outro" (máx. 40, MESMA regra do bloqueio de contato — sem telefone/
 * e-mail/apps). Devolve null se inválido.
 */
function normalizarCategoria(raw: string): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (v === CATEGORIA_NAO_INFORMAR) return v;
  if (isCategoriaKey(v)) return v;
  if (v.startsWith(CATEGORIA_OUTRO_PREFIX)) {
    const livre = v.slice(CATEGORIA_OUTRO_PREFIX.length).trim().slice(0, CATEGORIA_OUTRO_MAXLEN);
    if (!livre) return CATEGORIA_OUTRO_PREFIX; // "Outro" sem texto
    if (contemContato(livre)) return null; // bloqueia telefone/e-mail/apps
    return CATEGORIA_OUTRO_PREFIX + livre;
  }
  return null;
}

/** Lê a MINHA categoria profissional (valor armazenado). null se ausente/demo. */
export async function getMinhaCategoria(): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("professional_category")
    .eq("id", user.id)
    .maybeSingle();
  return (data?.professional_category as string | null) ?? null;
}

/** Grava a MINHA categoria profissional (RLS: só o próprio perfil). */
export async function setMinhaCategoria(raw: string): Promise<Result> {
  const value = normalizarCategoria(raw);
  if (value === null) {
    return { ok: false, error: "Categoria inválida ou com contato no campo livre." };
  }
  const supabase = await createClient();
  if (!supabase) return { ok: true }; // demo/preview: sem servidor
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada." };
  const { error } = await supabase
    .from("profiles")
    .update({ professional_category: value })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Não foi possível salvar agora." };
  revalidatePath("/dashboard/conta");
  return { ok: true };
}
