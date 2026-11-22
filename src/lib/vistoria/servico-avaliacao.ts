/*
  E1079 (ORDEM-DUET-385, tela 4 — mockup morador-servico-avaliador): o cartão "Avaliação do imóvel — Laudo com o nível
  do imóvel" na grade de Serviços. Quem pede a avaliação é o DONO, na página Nível de cada imóvel; o cartão leva à
  lista dos imóveis dele. A avaliação NÃO vira categoria contratável do catálogo (segue só de credenciamento).
  Fechado com a chave: só aparece quando a avaliação está aberta para a conta (global, laboratório ou piloto) e a conta
  tem imóvel. Leitura que falha: sem cartão.
*/
import { createClient } from "@/lib/supabase/server";
import { vistoriaAtiva } from "./chave";

export const HREF_AVALIACAO_NA_GRADE = "/dashboard/imoveis";

export async function avaliacaoNaGrade(): Promise<{ href: string } | null> {
  if (!(await vistoriaAtiva())) return null;
  try {
    const supabase = await createClient();
    if (!supabase) return null;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { count, error } = await supabase.from("properties").select("id", { count: "exact", head: true }).eq("owner_id", user.id);
    if (error || !count) return null;
    return { href: HREF_AVALIACAO_NA_GRADE };
  } catch {
    return null;
  }
}
