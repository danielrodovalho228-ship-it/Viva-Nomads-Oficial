/*
  E425 — o núcleo da ativação da parceria, o mesmo para os dois caminhos:
   - o link do e-mail de aprovação (/parceiros/ativar?t=…, token de 7 dias e uso único);
   - o botão "Ativar minha página" no painel de parceiro (/dashboard/parceiro), para a MESMA conta do pedido.
  Ativar = virar a solicitação de 'aprovada' para 'ativada' (uma vez só) e criar o papel (parceiros, rascunho) com os
  dados do pedido. Sem "use server" e sem cliente próprio: recebe o cliente de serviço (testável com um falso).
  Roda: node --test src/lib/parceiros/e425-ativacao.test.ts
*/
import { mesmoEmail, slugBase } from "./regras.ts";

export interface SolicitacaoAtivavel {
  id: string;
  user_id: string | null;
  email: string;
  nome: string;
  tipo_pessoa: string | null;
  emite_nota: boolean | null;
  documento: string | null;
  telefone: string | null;
  categorias: string[] | null;
  cidades: string[] | null;
  descricao: string | null;
  status: string;
}

export interface ContaQueAtiva {
  id: string;
  email: string | null | undefined;
  emailConfirmado: boolean;
}

export type ResultadoAtivacao = { ok: true; slug: string } | { ok: false; erro: string };

export const ERRO_ATIVAR_AGORA = "Não foi possível ativar agora. Tente de novo.";
export const ERRO_CONFIRME_EMAIL = "Confirme o seu e-mail antes de ativar.";

/**
 * O painel só ativa o pedido APROVADO da própria conta: o pedido ligado a esta conta (user_id) ou, sem conta ligada
 * (pedido aberto pela equipe), com o mesmo e-mail. E-mail da conta confirmado.
 */
export function podeAtivarPeloPainel(sol: Pick<SolicitacaoAtivavel, "status" | "user_id" | "email"> | null, conta: ContaQueAtiva): boolean {
  if (!sol || sol.status !== "aprovada" || !conta.emailConfirmado) return false;
  if (sol.user_id) return sol.user_id === conta.id;
  return mesmoEmail(conta.email, sol.email);
}

// O mínimo do cliente de serviço que a ativação usa (o falso do teste implementa o mesmo).
/* eslint-disable @typescript-eslint/no-explicit-any */
type Cliente = { from(tabela: string): any };

/** Ativa a solicitação para a conta `userId`. A conferência de quem pode ativar é de quem chama. */
export async function concluirAtivacao(admin: Cliente, sol: SolicitacaoAtivavel, userId: string, msgJaAtivada = "Esta parceria já foi ativada."): Promise<ResultadoAtivacao> {
  // Uso único: só quem virar a solicitação de 'aprovada' para 'ativada' segue.
  const agora = new Date().toISOString();
  const { data: usado, error: erroUso } = await admin
    .from("parceiro_solicitacoes")
    .update({ status: "ativada", user_id: userId, atualizado_em: agora })
    .eq("id", sol.id)
    .eq("status", "aprovada")
    .select("id");
  if (erroUso) return { ok: false, erro: ERRO_ATIVAR_AGORA };
  if (!usado?.length) return { ok: false, erro: msgJaAtivada };

  const devolver = () => admin.from("parceiro_solicitacoes").update({ status: "aprovada" }).eq("id", sol.id);

  const { data: existente, error: erroLer } = await admin.from("parceiros").select("slug").eq("user_id", userId).maybeSingle();
  if (erroLer) {
    await devolver();
    return { ok: false, erro: ERRO_ATIVAR_AGORA };
  }
  if (existente) return { ok: true, slug: existente.slug as string };

  const base = slugBase(sol.nome);
  for (let i = 0; i < 20; i++) {
    const slug = i === 0 ? base : `${base.slice(0, 54)}-${i + 1}`;
    const { error } = await admin.from("parceiros").insert({
      user_id: userId,
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
    if (error.code !== "23505" || !/slug/.test(String(error.message))) {
      console.error("[parceria] ativação falhou:", error.code, error.message);
      // Devolve o pedido para 'aprovada': pode tentar de novo (link ou painel).
      await devolver();
      return { ok: false, erro: ERRO_ATIVAR_AGORA };
    }
  }
  await devolver();
  return { ok: false, erro: ERRO_ATIVAR_AGORA };
}
