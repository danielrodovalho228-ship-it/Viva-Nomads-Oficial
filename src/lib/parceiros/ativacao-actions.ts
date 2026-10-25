"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailMascarado, mesmoEmail, situacaoToken, slugBase, type SituacaoToken } from "./regras";
import { hashToken, tokenBemFormado } from "./token";

/**
 * Ativação da parceria (Prompt 31a, item 4): /parceiros/ativar?t=. O token vale 7 dias e uma vez. Só a conta com o
 * MESMO e-mail do pedido ativa; outra conta vê a mensagem clara e nada muda. Ativar cria o papel (parceiros,
 * rascunho) com os dados do pedido e leva ao cadastro completo.
 */

export interface EstadoAtivacao {
  situacao: SituacaoToken;
  /** "d•••@gmail.com" — qual conta usar (sem expor o e-mail inteiro). */
  emailDica: string | null;
  logado: boolean;
  emailCerto: boolean;
  nome: string | null;
}

async function lerPedido(token: string) {
  const admin = createAdminClient();
  if (!admin || !tokenBemFormado(token)) return { admin, sol: null };
  const { data } = await admin
    .from("parceiro_solicitacoes")
    .select("id, user_id, email, nome, tipo_pessoa, emite_nota, documento, telefone, categorias, cidades, descricao, status, token_expira_em")
    .eq("token_ativacao_hash", hashToken(token))
    .maybeSingle();
  return { admin, sol: data };
}

/** O que a tela mostra (sem gravar nada: abrir o link não ativa). */
export async function estadoAtivacao(token: string): Promise<EstadoAtivacao> {
  const { sol } = await lerPedido(token);
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  const situacao = situacaoToken(sol ? { status: sol.status as string, tokenExpiraEm: sol.token_expira_em as string | null } : null, new Date());
  return {
    situacao,
    emailDica: sol ? emailMascarado(sol.email as string) : null,
    logado: !!user,
    emailCerto: !!user && !!sol && mesmoEmail(user.email, sol.email as string),
    nome: (sol?.nome as string | undefined) ?? null,
  };
}

export async function ativarParceria(token: string): Promise<{ ok: true; slug: string } | { ok: false; erro: string }> {
  const { admin, sol } = await lerPedido(token);
  if (!admin || !sol) return { ok: false, erro: "Link inválido. Peça um novo link." };
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user) return { ok: false, erro: "Entre na sua conta para ativar." };
  if (!mesmoEmail(user.email, sol.email as string)) {
    return { ok: false, erro: `Esta conta não é a do pedido. Entre com a conta do e-mail ${emailMascarado(sol.email as string)} para ativar.` };
  }
  if (!user.email_confirmed_at) return { ok: false, erro: "Confirme o seu e-mail antes de ativar." };
  const sit = situacaoToken({ status: sol.status as string, tokenExpiraEm: sol.token_expira_em as string | null }, new Date());
  if (sit !== "valido") return { ok: false, erro: sit === "usado" ? "Este link já foi usado." : "Este link venceu. Peça um novo link." };

  // Uso único: só quem virar a solicitação de 'aprovada' para 'ativada' segue.
  const agora = new Date().toISOString();
  const { data: usado } = await admin
    .from("parceiro_solicitacoes")
    .update({ status: "ativada", user_id: user.id, atualizado_em: agora })
    .eq("id", sol.id)
    .eq("status", "aprovada")
    .select("id");
  if (!usado?.length) return { ok: false, erro: "Este link já foi usado." };

  const { data: existente } = await admin.from("parceiros").select("slug").eq("user_id", user.id).maybeSingle();
  if (existente) return { ok: true, slug: existente.slug as string };

  const base = slugBase(sol.nome as string);
  for (let i = 0; i < 20; i++) {
    const slug = i === 0 ? base : `${base.slice(0, 54)}-${i + 1}`;
    const { error } = await admin.from("parceiros").insert({
      user_id: user.id,
      solicitacao_id: sol.id,
      tipo_pessoa: sol.tipo_pessoa,
      emite_nota: sol.tipo_pessoa === "pj" ? ((sol.emite_nota as boolean | null) ?? null) : null,
      documento: sol.documento,
      razao_social: sol.tipo_pessoa === "pj" ? sol.nome : null,
      nome_publico: String(sol.nome).slice(0, 80),
      slug,
      categorias: sol.categorias,
      cidades: sol.cidades,
      descricao: sol.descricao,
      telefone: sol.telefone,
      status: "rascunho",
    });
    if (!error) return { ok: true, slug };
    if (error.code !== "23505" || !/slug/.test(error.message)) {
      console.error("[parceria] ativação falhou:", error.code, error.message);
      // Devolve o pedido para 'aprovada': o mesmo link pode ser usado de novo.
      await admin.from("parceiro_solicitacoes").update({ status: "aprovada" }).eq("id", sol.id);
      return { ok: false, erro: "Não foi possível ativar agora. Tente de novo." };
    }
  }
  await admin.from("parceiro_solicitacoes").update({ status: "aprovada" }).eq("id", sol.id);
  return { ok: false, erro: "Não foi possível ativar agora. Tente de novo." };
}
