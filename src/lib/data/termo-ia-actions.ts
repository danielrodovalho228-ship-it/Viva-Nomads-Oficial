"use server";

import { createClient } from "@/lib/supabase/server";
import { TERMO_IA_VERSAO } from "@/lib/anuncio/termo-ia";

/**
 * L2-B item 23: o aceite do termo de IA do próprio dono, lido do servidor ao abrir o cadastro e o editor. Só a versão
 * ATUAL vale; sem sessão (ou sem a 0241) devolve null e a caixa aparece como antes.
 */
export async function meuAceiteTermoIa(): Promise<{ versao: string; aceitoEm: string } | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from("termo_ia_aceites").select("versao, aceito_em").eq("user_id", user.id).eq("versao", TERMO_IA_VERSAO).maybeSingle();
  if (error || !data) return null;
  return { versao: String(data.versao), aceitoEm: String(data.aceito_em) };
}
