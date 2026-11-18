"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * A conta já anunciou algum imóvel (qualquer status, inclusive rascunho)? Revela as
 * seções de dono no menu em cascata (ordem 9f3085d8, conta única). Só conta; a RLS de
 * properties já limita ao próprio dono. Sem Supabase (demonstração) = sim.
 */
export async function temImovelAnunciado(): Promise<boolean> {
  const supabase = await createClient();
  if (!supabase) return true;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { count, error } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);
  if (error) return false;
  return (count ?? 0) > 0;
}

const MSG_ATIVOS_NAO_CARREGARAM = "Não foi possível contar os seus imóveis ativos agora.";

/**
 * Quantos imóveis ATIVOS a conta tem (para a "Análise da carteira", que abre a partir de 3). Com `exigir` (a tela da
 * Carteira), a falha do banco LANÇA — o painel mostra "Não conseguimos abrir esta tela" em vez de "Você tem 0 imóveis
 * ativos". Sem `exigir` (contadores do menu), a falha segue valendo 0 (auditoria de erros e estados vazios, rodada 5).
 */
export async function imoveisAtivosDoDono(opcoes: { exigir?: boolean } = {}): Promise<number> {
  const supabase = await createClient();
  if (!supabase) return 0;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  const { count, error } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .eq("status", "active");
  if (error && opcoes.exigir) throw new Error(MSG_ATIVOS_NAO_CARREGARAM);
  return error ? 0 : (count ?? 0);
}
