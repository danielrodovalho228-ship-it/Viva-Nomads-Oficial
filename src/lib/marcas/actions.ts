"use server";

import { createClient } from "@/lib/supabase/server";
import { isExemplo } from "@/lib/demo-listing";
import { gravarMarca, idValido } from "./servidor";
import { mapaDeMarcas, type Marca } from "./regra";

/** Marca "Visto" ao abrir o anúncio. Só logado; anúncio de exemplo e id inválido são ignorados. */
export async function marcarVisto(imovelId: string): Promise<{ ok: boolean }> {
  if (!idValido(imovelId) || isExemplo(imovelId)) return { ok: false };
  const supabase = await createClient();
  if (!supabase) return { ok: false };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  return { ok: await gravarMarca(supabase, user.id, imovelId, "visto_em") };
}

/** Todas as marcas do usuário logado (a RLS devolve só as dele). Deslogado: vazio. */
export async function listarMarcas(): Promise<Record<string, Marca>> {
  const supabase = await createClient();
  if (!supabase) return {};
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};
  const { data } = await supabase
    .from("imovel_marcas")
    .select("imovel_id, visto_em, contatado_em")
    .eq("user_id", user.id)
    .limit(2000);
  return mapaDeMarcas(data ?? []);
}
