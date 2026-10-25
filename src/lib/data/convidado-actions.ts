"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { LIMITE_BUSCAS_SALVAS, normalizarBusca, resumoDaBusca } from "@/lib/busca/buscas-salvas";
import { MAX_GUARDADOS_CONVIDADO, mesclarSemDuplicar } from "@/lib/convidado/guardados";

/**
 * Prompt 49 — ao entrar ou criar conta, o que o convidado guardou no aparelho vai para a conta, sem duplicar.
 * Sempre como a própria pessoa (RLS de favorites e buscas_salvas). Devolve a lista da conta já mesclada.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function sessao() {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

export async function mesclarFavoritosConvidado(bruto: unknown): Promise<{ ok: boolean; ids: string[] }> {
  const s = await sessao();
  if (!s) return { ok: false, ids: [] };
  const locais = (Array.isArray(bruto) ? bruto : []).filter((x): x is string => typeof x === "string" && UUID.test(x)).slice(0, MAX_GUARDADOS_CONVIDADO);
  const { data } = await s.supabase.from("favorites").select("property_id").eq("tenant_id", s.user.id);
  const daConta = (data ?? []).map((r) => r.property_id as string);
  const { novos, todos } = mesclarSemDuplicar(locais, daConta);
  if (novos.length) {
    const { error } = await s.supabase.from("favorites").insert(novos.map((property_id) => ({ tenant_id: s.user.id, property_id })));
    // Corrida com outro aparelho (já existe): tenta um a um e ignora o repetido.
    if (error) {
      for (const property_id of novos) await s.supabase.from("favorites").insert({ tenant_id: s.user.id, property_id });
    }
  }
  return { ok: true, ids: todos };
}

export async function mesclarBuscasConvidado(bruto: unknown): Promise<{ ok: boolean; salvas: number }> {
  const s = await sessao();
  if (!s) return { ok: false, salvas: 0 };
  const locais = [...new Set((Array.isArray(bruto) ? bruto : []).filter((x): x is string => typeof x === "string").map(normalizarBusca).filter(Boolean))];
  const { data } = await s.supabase.from("buscas_salvas").select("parametros").eq("usuario_id", s.user.id);
  const daConta = (data ?? []).map((r) => r.parametros as string);
  const { novos } = mesclarSemDuplicar(locais, daConta);
  const cabem = novos.slice(0, Math.max(0, LIMITE_BUSCAS_SALVAS - daConta.length));
  if (cabem.length) {
    await s.supabase.from("buscas_salvas").insert(cabem.map((parametros) => ({ usuario_id: s.user.id, parametros, resumo: resumoDaBusca(parametros) })));
    revalidatePath("/dashboard/buscas");
  }
  return { ok: true, salvas: cabem.length };
}
