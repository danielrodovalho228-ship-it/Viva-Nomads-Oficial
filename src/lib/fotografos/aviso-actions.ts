"use server";

import { createClient } from "@/lib/supabase/server";
import { situacaoLimite } from "@/lib/limites";
import { validarAvisoFotografo } from "./aviso";
import { categoriaValida, rotuloCategoria } from "@/lib/parceiros/regras";

export type ResultadoAviso = { ok: boolean; erro?: string; mensagem?: string };

/**
 * "Avise-me quando houver fotógrafo parceiro na minha cidade" (QA do Muse, 18/10). Quem pede vem da SESSÃO e o
 * contato é o do perfil (nada de e-mail/telefone no formulário). Uma linha por pessoa e cidade (0162).
 */
export async function avisarFotografoNaCidade(entrada: { cidade: string; uf: string; categoria?: string }): Promise<ResultadoAviso> {
  const v = validarAvisoFotografo(entrada);
  if (!v.ok) return { ok: false, erro: v.erro };
  // Prompt 31a: o avise-me vale para qualquer categoria de parceiro (0190); sem categoria = fotografia.
  const categoria = entrada.categoria && categoriaValida(entrada.categoria) ? entrada.categoria : "fotografia";
  const supabase = await createClient();
  if (!supabase) return { ok: false, erro: "Indisponível no modo demonstração." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Entre na sua conta para receber o aviso." };
  // Só barra quando o limite ESTOUROU; falha do limitador (infra) não impede o pedido de aviso — antes virava
  // "Muitas tentativas" e nada era gravado (Prompt 29, item 3).
  if ((await situacaoLimite(`aviso-fotografo:${user.id}`, 20, 3600)) === "estourou") return { ok: false, erro: "Muitas tentativas. Tente de novo mais tarde." };
  // Insert simples: 23505 = a pessoa já tinha pedido aviso para esta cidade (vale como sucesso).
  const { error } = await supabase.from("interesse_fotografo_cidade").insert({ user_id: user.id, uf: v.uf, chave: v.chave, cidade: v.cidade, categoria });
  if (error && error.code !== "23505") {
    console.error("[aviso-fotografo] gravação falhou:", error.code, error.message);
    return { ok: false, erro: "Não foi possível registrar agora. Tente novamente." };
  }
  // "Anotado" só depois de CONFIRMAR que a linha está no banco.
  const { data: gravado, error: eLeitura } = await supabase
    .from("interesse_fotografo_cidade")
    .select("id")
    .eq("user_id", user.id)
    .eq("uf", v.uf)
    .eq("chave", v.chave)
    .eq("categoria", categoria)
    .maybeSingle();
  if (eLeitura || !gravado) {
    console.error("[aviso-fotografo] confirmação falhou:", eLeitura?.code ?? "sem linha");
    return { ok: false, erro: "Não foi possível confirmar o pedido de aviso. Tente novamente." };
  }
  return {
    ok: true,
    mensagem: categoria === "fotografia" ? v.mensagem : `Anotado! Avisamos você quando houver parceiro de ${rotuloCategoria(categoria).toLowerCase()} em ${v.cidade}.`,
  };
}
