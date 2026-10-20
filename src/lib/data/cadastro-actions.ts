"use server";

import { createClient } from "@/lib/supabase/server";
import { sugestaoDaRegiao } from "@/lib/anuncio/sugestoes-cadastro";

/**
 * Preço sugerido do cadastro (prompt 10, etapa 4): mediana do valor mensal de anúncios ATIVOS e reais da Viva com o
 * mesmo número de quartos — no mesmo bairro quando há pelo menos 3, senão na cidade. Sem dados suficientes, null:
 * a tela não sugere nada (nunca um número inventado). Lê só colunas públicas do anúncio.
 */
export async function precoDaRegiao(entrada: {
  cidade: string;
  bairro: string;
  quartos: number;
}): Promise<{ valor: number; base: "bairro" | "cidade"; n: number } | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const cidade = String(entrada.cidade ?? "").trim().slice(0, 100);
  const bairro = String(entrada.bairro ?? "").trim().toLowerCase().slice(0, 100);
  const quartos = Math.max(0, Math.min(20, Math.floor(Number(entrada.quartos) || 0)));
  if (!cidade) return null;
  const { data } = await supabase
    .from("properties")
    .select("monthly_price, address")
    .eq("status", "active")
    .ilike("city", cidade)
    .eq("bedrooms", quartos)
    .gt("monthly_price", 0)
    .limit(500);
  const linhas = (data ?? []) as { monthly_price: number | null; address: string | null }[];
  const daCidade = linhas.map((l) => Number(l.monthly_price) || 0);
  const doBairro = bairro ? linhas.filter((l) => (l.address ?? "").trim().toLowerCase() === bairro).map((l) => Number(l.monthly_price) || 0) : [];
  return sugestaoDaRegiao(doBairro, daCidade);
}
