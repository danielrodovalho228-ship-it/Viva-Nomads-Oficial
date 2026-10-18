import type { SupabaseClient } from "@supabase/supabase-js";
import { chaveCidade } from "../cidades.ts";
import { cidadeLiberada, mensagemCidadeNaoLiberada, type CidadeLiberada } from "./regras.ts";

/** Lê a lista pública de cidades. Devolve null em erro (tabela ausente antes da 0159): quem chama decide. */
export async function listarCidades(supabase: SupabaseClient): Promise<(CidadeLiberada & { liberada_em: string | null; observacao: string | null })[] | null> {
  const { data, error } = await supabase
    .from("cidades_liberadas")
    .select("uf, chave, cidade, liberada, liberada_em, observacao")
    .order("cidade", { ascending: true })
    .limit(500);
  if (error || !data) return null;
  return data as (CidadeLiberada & { liberada_em: string | null; observacao: string | null })[];
}

/**
 * Trava de PUBLICAÇÃO no servidor (ordem 335b4064, item 2): texto do bloqueio se a cidade do anúncio não
 * está liberada; null se pode publicar. Falha ABERTA quando a tabela não responde (migração ainda não
 * aplicada) — o rascunho nunca passa por aqui, e um erro de leitura não derruba a publicação de quem já opera.
 */
export async function bloqueioPorCidade(supabase: SupabaseClient, cidade: string | null | undefined): Promise<string | null> {
  const lista = await listarCidades(supabase);
  if (!lista) return null;
  const nome = (cidade ?? "").trim();
  if (nome && cidadeLiberada(lista, nome)) return null;
  return mensagemCidadeNaoLiberada(nome || "essa cidade");
}

/**
 * Dono tentou publicar em cidade fechada: grava o interesse dele (papel proprietário) quando a UF é inequívoca
 * (um só município com esse nome). O anúncio só guarda o nome da cidade, então a UF vem da lista do IBGE. Best-effort.
 */
export async function anotarInteresseDoDono(
  supabase: SupabaseClient,
  userId: string,
  cidade: string,
  municipios: Record<string, readonly string[]>,
): Promise<void> {
  const chave = chaveCidade(cidade);
  if (!chave) return;
  const ufs = Object.keys(municipios).filter((uf) => municipios[uf].some((m) => chaveCidade(m) === chave));
  if (ufs.length !== 1) return;
  const oficial = municipios[ufs[0]].find((m) => chaveCidade(m) === chave) ?? cidade;
  try {
    await supabase
      .from("interesse_cidade")
      .upsert({ user_id: userId, uf: ufs[0], chave, cidade: oficial, papel: "proprietario" }, { onConflict: "user_id,uf,chave,papel", ignoreDuplicates: true });
  } catch {
    /* melhor esforço */
  }
}
