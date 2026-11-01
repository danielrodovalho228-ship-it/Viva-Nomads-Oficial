"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailMascarado, mesmoEmail, situacaoToken, type SituacaoToken } from "./regras";
import { concluirAtivacao, ERRO_ATIVAR_AGORA, ERRO_CONFIRME_EMAIL, podeAtivarPeloPainel, type SolicitacaoAtivavel } from "./ativacao-nucleo";
import { hashToken, tokenBemFormado } from "./token";

/**
 * Ativação da parceria (Prompt 31a, item 4): /parceiros/ativar?t=. O token vale 7 dias e uma vez. Só a conta com o
 * MESMO e-mail do pedido ativa; outra conta vê a mensagem clara e nada muda. Ativar cria o papel (parceiros,
 * rascunho) com os dados do pedido e leva ao cadastro completo. E425: o mesmo núcleo (ativacao-nucleo) serve ao botão
 * do painel, para a conta do pedido ativar sem depender do e-mail.
 */

export interface EstadoAtivacao {
  situacao: SituacaoToken;
  /** "d•••@gmail.com" — qual conta usar (sem expor o e-mail inteiro). */
  emailDica: string | null;
  logado: boolean;
  emailCerto: boolean;
  nome: string | null;
}

const COLUNAS_PEDIDO = "id, user_id, email, nome, tipo_pessoa, emite_nota, documento, telefone, categorias, cidades, descricao, status";

async function lerPedido(token: string) {
  const admin = createAdminClient();
  if (!admin || !tokenBemFormado(token)) return { admin, sol: null };
  const { data } = await admin
    .from("parceiro_solicitacoes")
    .select(`${COLUNAS_PEDIDO}, token_expira_em`)
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
  if (!user.email_confirmed_at) return { ok: false, erro: ERRO_CONFIRME_EMAIL };
  const sit = situacaoToken({ status: sol.status as string, tokenExpiraEm: sol.token_expira_em as string | null }, new Date());
  if (sit !== "valido") return { ok: false, erro: sit === "usado" ? "Este link já foi usado." : "Este link venceu. Peça um novo link." };
  return concluirAtivacao(admin, sol as unknown as SolicitacaoAtivavel, user.id, "Este link já foi usado.");
}

/**
 * E425 — ativar pelo painel (/dashboard/parceiro), sem depender do e-mail: só o pedido APROVADO da própria conta
 * (ligado a ela ou, sem conta ligada, com o mesmo e-mail) e com o e-mail da conta confirmado. Mesmo núcleo do link.
 */
export async function ativarPeloPainel(): Promise<{ ok: true; slug: string } | { ok: false; erro: string }> {
  const supabase = await createClient();
  const admin = createAdminClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user) return { ok: false, erro: "Entre na sua conta para ativar." };
  if (!admin) return { ok: false, erro: ERRO_ATIVAR_AGORA };
  const { data, error } = await admin
    .from("parceiro_solicitacoes")
    .select(COLUNAS_PEDIDO)
    .eq("status", "aprovada")
    .or(`user_id.eq.${user.id}${user.email ? `,email.eq.${user.email.toLowerCase()}` : ""}`)
    .order("criado_em", { ascending: false })
    .limit(5);
  if (error) return { ok: false, erro: ERRO_ATIVAR_AGORA };
  const conta = { id: user.id, email: user.email, emailConfirmado: !!user.email_confirmed_at };
  const sol = ((data ?? []) as unknown as SolicitacaoAtivavel[]).find((x) => podeAtivarPeloPainel(x, conta));
  if (!sol) {
    if (!conta.emailConfirmado && (data ?? []).length) return { ok: false, erro: ERRO_CONFIRME_EMAIL };
    return { ok: false, erro: "Não há parceria aprovada para esta conta." };
  }
  return concluirAtivacao(admin, sol, user.id);
}
