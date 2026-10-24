"use server";

import { createClient } from "@/lib/supabase/server";
import { erroBancoPT } from "@/lib/erros-banco";
import { ehTipoChavePix, mascararChavePix, normalizarChavePix, rotuloTipoChavePix, type ChavePix } from "@/lib/conta/chave-pix";

type Resultado = { ok: boolean; error?: string };

/** O que a tela mostra: o tipo e a chave MASCARADA. A chave inteira só volta para o próprio dono ao copiar. */
export interface MinhaChavePix {
  tipo: ChavePix["tipo"];
  rotuloTipo: string;
  mascarada: string;
  chave: string;
  atualizadoEm: string;
}

/**
 * PERFIL-B (mockup perfil-07-pagamentos, "Como você recebe"): a chave Pix em que o proprietário recebe o valor mensal
 * direto do morador. Tudo pelo cliente da SESSÃO: a RLS da 0236 só deixa a própria pessoa ler e gravar a sua linha.
 * Sem a tabela (0236 ainda não aplicada) a leitura volta null e a tela segue só com o texto.
 */
export async function minhaChavePix(): Promise<MinhaChavePix | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from("recebimento_pix").select("tipo, chave, atualizado_em").eq("user_id", user.id).maybeSingle();
  if (error || !data) return null;
  const linha = data as { tipo: string; chave: string; atualizado_em: string };
  if (!ehTipoChavePix(linha.tipo)) return null;
  const c: ChavePix = { tipo: linha.tipo, chave: linha.chave };
  return { tipo: c.tipo, rotuloTipo: rotuloTipoChavePix(c.tipo), mascarada: mascararChavePix(c), chave: c.chave, atualizadoEm: linha.atualizado_em };
}

export async function salvarChavePix(tipo: string, chave: string): Promise<Resultado> {
  const r = normalizarChavePix(tipo, chave);
  if (!r.ok) return { ok: false, error: r.erro };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Sem conexão com o banco." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para salvar a chave." };
  const { error } = await supabase
    .from("recebimento_pix")
    .upsert({ user_id: user.id, tipo: r.chave.tipo, chave: r.chave.chave, atualizado_em: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return { ok: false, error: erroBancoPT(error, "Não foi possível salvar a chave Pix.") };
  return { ok: true };
}

export async function removerChavePix(): Promise<Resultado> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Sem conexão com o banco." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para remover a chave." };
  const { error } = await supabase.from("recebimento_pix").delete().eq("user_id", user.id);
  if (error) return { ok: false, error: erroBancoPT(error, "Não foi possível remover a chave Pix.") };
  return { ok: true };
}
