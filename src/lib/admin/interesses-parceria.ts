import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { COLUNAS_INTERESSE, ordenarInteresses, type InteresseParceria } from "./interesse-parceria";

/*
  E223 — a fonte única dos interesses de parceria: a lista de /admin/parceiros, o contador do painel e o atalho do admin
  leem por aqui (mesma consulta, mesma regra). Sem "use server": função interna, nunca chamada do navegador. A RLS
  (0104) só deixa admin ler; quem chama passa o cliente da sessão.
*/
export async function lerInteressesParceria(cliente: SupabaseClient): Promise<InteresseParceria[] | null> {
  const { data, error } = await cliente.from("parceiros_interesse").select(COLUNAS_INTERESSE).order("criado_em", { ascending: true }).limit(500);
  if (error) return null;
  return ordenarInteresses((data ?? []) as InteresseParceria[]);
}
