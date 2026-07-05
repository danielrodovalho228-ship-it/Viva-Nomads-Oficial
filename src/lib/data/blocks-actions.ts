"use server";

import { createClient } from "@/lib/supabase/server";

export interface BlocoDatas {
  id: string;
  inicio: string; // ISO
  fim: string; // ISO
}

type ActionResult = { ok: boolean; demo?: boolean; error?: string; id?: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Datas bloqueadas de um imóvel (leitura pública). [] em demo/sem backend. */
export async function getBlocks(propertyId: string): Promise<BlocoDatas[]> {
  const supabase = await createClient();
  if (!supabase || !UUID_RE.test(propertyId)) return [];
  const { data } = await supabase
    .from("property_blocks")
    .select("id, inicio, fim")
    .eq("property_id", propertyId)
    .order("inicio", { ascending: true });
  return (data ?? []).map((b) => ({
    id: String(b.id),
    inicio: String(b.inicio),
    fim: String(b.fim),
  }));
}

/** Proprietário BLOQUEIA um intervalo. RLS garante que só o dono insere. */
export async function addBlock(
  propertyId: string,
  inicio: string,
  fim: string
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para bloquear datas." };
  if (!UUID_RE.test(propertyId)) return { ok: true, demo: true };
  if (!inicio || !fim || fim < inicio)
    return { ok: false, error: "Intervalo de datas inválido." };

  const { data, error } = await supabase
    .from("property_blocks")
    .insert({ property_id: propertyId, inicio, fim })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id };
}

/** Remove um bloqueio (RLS: só o dono). */
export async function removeBlock(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  if (!UUID_RE.test(id)) return { ok: true, demo: true };
  const { error } = await supabase.from("property_blocks").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
