"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { LIMITE_BUSCAS_SALVAS, normalizarBusca, resumoDaBusca } from "@/lib/busca/buscas-salvas";

/**
 * Buscas salvas (ordem d15ef6bf) — sempre como a própria pessoa (RLS da 0122:
 * cada um lê/cria/apaga só as suas). Visitante sem login recebe `precisaEntrar`.
 */
export type BuscaSalva = { id: string; parametros: string; resumo: string; criadoEm: string };
type Res<T> = ({ ok: true } & T) | { ok: false; error: string; precisaEntrar?: boolean };

async function sessao() {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

/** A busca atual já está salva? (null = visitante). */
export async function buscaEstaSalva(qs: string): Promise<{ salva: boolean | null }> {
  const s = await sessao();
  if (!s) return { salva: null };
  const parametros = normalizarBusca(qs);
  const { data } = await s.supabase.from("buscas_salvas").select("id").eq("usuario_id", s.user.id).eq("parametros", parametros).maybeSingle();
  return { salva: !!data };
}

/** Salva (ou, se já salva, remove) a busca atual — o coração alterna. */
export async function alternarBuscaSalva(qs: string): Promise<Res<{ salva: boolean }>> {
  const s = await sessao();
  if (!s) return { ok: false, error: "Entre para salvar esta busca.", precisaEntrar: true };
  const parametros = normalizarBusca(qs);
  const { data: existente } = await s.supabase
    .from("buscas_salvas")
    .select("id")
    .eq("usuario_id", s.user.id)
    .eq("parametros", parametros)
    .maybeSingle();
  if (existente) {
    const { error } = await s.supabase.from("buscas_salvas").delete().eq("id", existente.id);
    if (error) return { ok: false, error: "Não foi possível remover a busca. Tente de novo." };
    revalidatePath("/dashboard/buscas");
    return { ok: true, salva: false };
  }
  const { count } = await s.supabase.from("buscas_salvas").select("id", { count: "exact", head: true }).eq("usuario_id", s.user.id);
  if ((count ?? 0) >= LIMITE_BUSCAS_SALVAS) return { ok: false, error: `Você já tem ${LIMITE_BUSCAS_SALVAS} buscas salvas. Apague uma em Buscas salvas.` };
  const { error } = await s.supabase.from("buscas_salvas").insert({ usuario_id: s.user.id, parametros, resumo: resumoDaBusca(parametros) });
  if (error) return { ok: false, error: "Não foi possível salvar a busca. Tente de novo." };
  revalidatePath("/dashboard/buscas");
  return { ok: true, salva: true };
}

/** Buscas salvas da própria pessoa (mais recentes primeiro). */
export async function listarBuscasSalvas(): Promise<BuscaSalva[]> {
  const s = await sessao();
  if (!s) return [];
  const { data } = await s.supabase
    .from("buscas_salvas")
    .select("id, parametros, resumo, criado_em")
    .eq("usuario_id", s.user.id)
    .order("criado_em", { ascending: false })
    .limit(LIMITE_BUSCAS_SALVAS);
  return (data ?? []).map((r) => ({ id: r.id, parametros: r.parametros, resumo: r.resumo, criadoEm: r.criado_em }));
}

/** Apaga uma busca salva (RLS garante que é da própria pessoa). */
export async function apagarBuscaSalva(id: string): Promise<Res<object>> {
  const s = await sessao();
  if (!s) return { ok: false, error: "Entre para gerenciar suas buscas.", precisaEntrar: true };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "Busca inválida." };
  const { error } = await s.supabase.from("buscas_salvas").delete().eq("id", id).eq("usuario_id", s.user.id);
  if (error) return { ok: false, error: "Não foi possível apagar. Tente de novo." };
  revalidatePath("/dashboard/buscas");
  return { ok: true };
}
