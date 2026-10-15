"use server";

import { createClient } from "@/lib/supabase/server";
import { TAXA_COMISSAO_PADRAO } from "@/lib/cobranca/regra";
import { taxaDoNovoAnuncio } from "@/lib/preco-justo";

/** Taxa da faixa do dono logado (RLS: só conta os imóveis dele). Sem sessão ou com erro, vale a faixa inicial. */
export async function taxaDoMeuNovoAnuncio(): Promise<number> {
  try {
    const supabase = await createClient();
    if (!supabase) return TAXA_COMISSAO_PADRAO;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return TAXA_COMISSAO_PADRAO;
    const { count } = await supabase.from("properties").select("id", { count: "exact", head: true }).eq("owner_id", user.id).eq("status", "active");
    return taxaDoNovoAnuncio(count ?? 0);
  } catch {
    return TAXA_COMISSAO_PADRAO;
  }
}
