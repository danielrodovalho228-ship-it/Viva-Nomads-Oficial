"use server";

import { createClient } from "@/lib/supabase/server";
import { consumirLimite } from "@/lib/limites";
import { validarAvisoFotografo } from "./aviso";

export type ResultadoAviso = { ok: boolean; erro?: string; mensagem?: string };

/**
 * "Avise-me quando houver fotógrafo parceiro na minha cidade" (QA do Muse, 18/10). Quem pede vem da SESSÃO e o
 * contato é o do perfil (nada de e-mail/telefone no formulário). Uma linha por pessoa e cidade (0162).
 */
export async function avisarFotografoNaCidade(entrada: { cidade: string; uf: string }): Promise<ResultadoAviso> {
  const v = validarAvisoFotografo(entrada);
  if (!v.ok) return { ok: false, erro: v.erro };
  const supabase = await createClient();
  if (!supabase) return { ok: false, erro: "Indisponível no modo demonstração." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Entre na sua conta para receber o aviso." };
  if (!(await consumirLimite(`aviso-fotografo:${user.id}`, 20, 3600))) return { ok: false, erro: "Muitas tentativas. Tente de novo mais tarde." };
  const { error } = await supabase
    .from("interesse_fotografo_cidade")
    .upsert({ user_id: user.id, uf: v.uf, chave: v.chave, cidade: v.cidade }, { onConflict: "user_id,uf,chave", ignoreDuplicates: true });
  if (error) return { ok: false, erro: "Não foi possível registrar agora. Tente novamente." };
  return { ok: true, mensagem: v.mensagem };
}
