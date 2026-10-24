"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumirLimite, HORA, ipHash } from "@/lib/limites";
import { notify } from "@/lib/notifications";
import { adminsPorAviso } from "@/lib/notifications/push-admins";
import { textoEmail } from "@/lib/notifications/texto-seguro";
import { mesmoEmail, rotuloCategoria, situacaoToken, validarSolicitacao, type SolicitacaoEntrada } from "./regras";
import { hashToken, tokenBemFormado } from "./token";

/**
 * Pedido de parceria (Prompt 31a, item 2). Exige conta com e-mail CONFIRMADO; o e-mail é sempre o da conta.
 * Uma solicitação aberta por conta (e por e-mail), limite por IP e armadilha (honeypot). Quem grava é o servidor.
 */

export type Res<T = null> = { ok: true; valor: T } | { ok: false; erro: string };

export interface MinhaParceria {
  logado: boolean;
  emailConfirmado: boolean;
  email: string | null;
  nome: string | null;
  /** Pedido aberto ou o último decidido (para mostrar o motivo da recusa). */
  solicitacao: {
    id: string;
    status: string;
    origem: string;
    motivoRecusa: string | null;
    nome: string;
    tipoPessoa: string | null;
    emiteNota: boolean | null;
    categorias: string[];
    cidades: string[];
    portfolioUrl: string | null;
    descricao: string | null;
  } | null;
  /** Já é parceiro (a página existe). */
  parceiro: { slug: string; status: string } | null;
}

async function sessao() {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = createAdminClient();
  return user && admin ? { supabase, admin, user } : null;
}

/** Estado do funil de parceria da pessoa logada (formulário pré-preenchido, Conta, painel). */
export async function minhaParceria(): Promise<MinhaParceria> {
  const s = await sessao();
  if (!s) return { logado: false, emailConfirmado: false, email: null, nome: null, solicitacao: null, parceiro: null };
  const email = s.user.email ?? null;
  const [{ data: perfil }, { data: parceiro }, { data: sols }] = await Promise.all([
    s.admin.from("profiles").select("full_name").eq("id", s.user.id).maybeSingle(),
    s.admin.from("parceiros").select("slug, status").eq("user_id", s.user.id).maybeSingle(),
    // Pela conta OU pelo e-mail (o pedido aberto pela equipe ainda não tem conta ligada).
    s.admin
      .from("parceiro_solicitacoes")
      .select("id, user_id, email, status, origem, motivo_recusa, nome, tipo_pessoa, emite_nota, categorias, cidades, portfolio_url, descricao, criado_em")
      .or(`user_id.eq.${s.user.id}${email ? `,email.eq.${email.toLowerCase()}` : ""}`)
      .order("criado_em", { ascending: false })
      .limit(5),
  ]);
  const abertas = ["aguardando_email", "pendente", "aprovada"];
  const lista = (sols ?? []).filter((x) => x.user_id === s.user.id || mesmoEmail(x.email as string, email));
  const sol = lista.find((x) => abertas.includes(x.status as string)) ?? lista[0] ?? null;
  return {
    logado: true,
    emailConfirmado: !!s.user.email_confirmed_at,
    email,
    nome: (perfil?.full_name as string | null) ?? null,
    solicitacao: sol
      ? {
          id: sol.id as string,
          status: sol.status as string,
          origem: sol.origem as string,
          motivoRecusa: (sol.motivo_recusa as string | null) ?? null,
          nome: sol.nome as string,
          tipoPessoa: (sol.tipo_pessoa as string | null) ?? null,
          emiteNota: (sol.emite_nota as boolean | null) ?? null,
          categorias: (sol.categorias as string[]) ?? [],
          cidades: (sol.cidades as string[]) ?? [],
          portfolioUrl: (sol.portfolio_url as string | null) ?? null,
          descricao: (sol.descricao as string | null) ?? null,
        }
      : null,
    parceiro: parceiro ? { slug: parceiro.slug as string, status: parceiro.status as string } : null,
  };
}

/** Avisa a equipe (e-mail + push de quem liga "receber alertas"). Best-effort. */
async function avisarEquipe(assunto: string, detalhe: string): Promise<void> {
  try {
    const admins = await adminsPorAviso<{ email: string | null; full_name: string | null; notif_email: boolean | null }>("operacional", "email, full_name, notif_email");
    for (const a of admins) {
      if (a.email && a.notif_email !== false) {
        await notify({ event: "parceria_equipe", email: a.email, name: a.full_name ?? undefined, userId: a.id, pushUrl: "/admin/parceiros", subject: assunto, detailsHtml: `<p>${textoEmail(detalhe, 200)}</p>` });
      }
    }
  } catch {
    /* best-effort */
  }
}

export async function enviarSolicitacao(entrada: SolicitacaoEntrada & { armadilha?: string; origem?: string }): Promise<Res<{ id: string }>> {
  // Armadilha preenchida = robô: responde como sucesso e não grava nada.
  if (String(entrada?.armadilha ?? "").trim()) return { ok: true, valor: { id: "" } };
  const s = await sessao();
  if (!s) return { ok: false, erro: "Entre na sua conta para pedir a parceria." };
  if (!s.user.email_confirmed_at || !s.user.email) return { ok: false, erro: "Confirme o seu e-mail (veja a sua caixa de entrada) e tente de novo." };
  const h = await headers();
  const ip = ipHash(new Request("http://local", { headers: h }));
  if (!(await consumirLimite(`parceria:ip:${ip}`, 5, HORA)) || !(await consumirLimite(`parceria:uid:${s.user.id}`, 5, HORA))) {
    return { ok: false, erro: "Muitas tentativas. Tente de novo mais tarde." };
  }
  const v = validarSolicitacao(entrada);
  if (!v.ok) return { ok: false, erro: v.erro };
  const email = s.user.email.trim().toLowerCase();

  const { data: jaParceiro } = await s.admin.from("parceiros").select("id").eq("user_id", s.user.id).maybeSingle();
  if (jaParceiro) return { ok: false, erro: "Esta conta já é parceira. Edite a sua página em Painel › Parceiro." };

  const dados = {
    user_id: s.user.id,
    email,
    nome: v.valor.nome,
    tipo_pessoa: v.valor.tipoPessoa,
    // FISCAL-PARCEIRO-B: validado no servidor (PJ: Sim/Não obrigatório; PF: sempre null, também pelo check da 0243).
    emite_nota: v.valor.emiteNota,
    documento: v.valor.documento,
    telefone: v.valor.telefone,
    categorias: v.valor.categorias,
    cidades: v.valor.cidades,
    portfolio_url: v.valor.portfolioUrl,
    descricao: v.valor.descricao,
    dados_categoria: v.valor.dadosCategoria,
    status: "pendente",
    atualizado_em: new Date().toISOString(),
  };

  // Pedido aberto pela equipe (suporte) para este e-mail: a pessoa completa e CONFIRMA (LGPD) — vira pendente.
  const { data: convite } = await s.admin.from("parceiro_solicitacoes").select("id").eq("email", email).eq("status", "aguardando_email").maybeSingle();
  let id: string;
  if (convite) {
    const { error } = await s.admin.from("parceiro_solicitacoes").update(dados).eq("id", convite.id);
    if (error) return { ok: false, erro: "Não foi possível enviar agora. Tente de novo." };
    id = convite.id as string;
  } else {
    const origem = entrada.origem === "conta" ? "conta" : "site";
    const { data, error } = await s.admin.from("parceiro_solicitacoes").insert({ ...dados, origem }).select("id").single();
    if (error) {
      if (error.code === "23505") return { ok: false, erro: "Você já tem um pedido de parceria em análise. A Viva responde por e-mail." };
      console.error("[parceria] gravação falhou:", error.code, error.message);
      return { ok: false, erro: "Não foi possível enviar agora. Tente de novo." };
    }
    id = data.id as string;
  }

  await notify({ event: "parceria_recebida", email, name: v.valor.nome, userId: s.user.id, pushUrl: "/dashboard/parceiro" });
  await avisarEquipe("Pedido de parceria para analisar", `${v.valor.nome}: ${v.valor.categorias.map(rotuloCategoria).join(", ")} em ${v.valor.cidades.join(", ")}.`);
  return { ok: true, valor: { id } };
}

/** Link vencido ou já usado: a pessoa pede um novo — a equipe é avisada (no máximo 1 aviso por dia). */
export async function pedirNovoLink(token: string): Promise<Res> {
  if (!tokenBemFormado(token)) return { ok: false, erro: "Link inválido." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, erro: "Indisponível agora." };
  const { data: sol } = await admin.from("parceiro_solicitacoes").select("id, nome, status, token_expira_em, novo_link_pedido_em").eq("token_ativacao_hash", hashToken(token)).maybeSingle();
  if (!sol) return { ok: false, erro: "Link inválido." };
  const sit = situacaoToken({ status: sol.status as string, tokenExpiraEm: sol.token_expira_em as string | null }, new Date());
  if (sit === "valido") return { ok: false, erro: "Este link ainda vale: use o botão de ativar." };
  const ultimo = sol.novo_link_pedido_em ? Date.parse(sol.novo_link_pedido_em as string) : 0;
  if (Date.now() - ultimo > 86_400_000) {
    await admin.from("parceiro_solicitacoes").update({ novo_link_pedido_em: new Date().toISOString() }).eq("id", sol.id);
    await avisarEquipe("Novo link de ativação pedido", `${sol.nome as string} pediu um novo link de ativação da parceria.`);
  }
  return { ok: true, valor: null };
}
