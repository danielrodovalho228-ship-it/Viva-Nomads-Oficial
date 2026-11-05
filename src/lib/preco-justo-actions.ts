"use server";

import { createClient } from "@/lib/supabase/server";
import { TAXA_COMISSAO_PADRAO } from "@/lib/cobranca/regra";
import { taxaDoNovoAnuncio } from "@/lib/preco-justo";
import { COLUNAS_FAIXA, contarAtivosDeVerdade } from "@/lib/cobranca/taxa-servidor";

/** Taxa da faixa do dono logado (RLS: só conta os imóveis dele). Sem sessão ou com erro, vale a faixa inicial. */
export async function taxaDoMeuNovoAnuncio(): Promise<number> {
  try {
    const supabase = await createClient();
    if (!supabase) return TAXA_COMISSAO_PADRAO;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return TAXA_COMISSAO_PADRAO;
    // E565: a mesma contagem da faixa — só os ativos de verdade (documento aprovado e calendário em dia).
    const { data, error } = await supabase.from("properties").select(COLUNAS_FAIXA).eq("owner_id", user.id).eq("status", "active");
    if (error) return TAXA_COMISSAO_PADRAO;
    return taxaDoNovoAnuncio(await contarAtivosDeVerdade(supabase, (data ?? []) as { id: string; status: string; disponibilidade_confirmada_em: string | null }[]));
  } catch {
    return TAXA_COMISSAO_PADRAO;
  }
}
