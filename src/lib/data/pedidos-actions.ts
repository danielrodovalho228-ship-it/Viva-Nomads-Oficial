"use server";

import { createClient } from "@/lib/supabase/server";
import { guardContactInfo } from "@/lib/messages/contact-guard";
import {
  contemContato,
  detectarContato,
  isMotivo,
  CONTATO_AVISO,
  MAX_PEDIDOS_ATIVOS,
} from "@/lib/pedidos/pedidos";

type ActionResult = { ok: boolean; demo?: boolean; id?: string; error?: string };

export interface PedidoInput {
  cidade: string;
  uf?: string;
  dataInicio: string; // ISO yyyy-mm-dd
  prazoMeses: number;
  orcamentoMensal: number;
  qtdOcupantes: number;
  motivo: string;
  apresentacao?: string;
}

/**
 * Cria um Pedido de Moradia (fluxo do inquilino). Valida no SERVIDOR: campos
 * obrigatórios, filtro anti-contato na apresentação (bloqueia telefone/e-mail/
 * mensageria) e limite de 2 pedidos ativos. Best-effort: no-op em demo/sem sessão.
 */
export async function criarPedido(input: PedidoInput): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para publicar um pedido." };

  // Validações de servidor (fonte da verdade).
  const cidade = (input.cidade ?? "").trim();
  if (!cidade) return { ok: false, error: "Informe a cidade." };
  if (!input.dataInicio) return { ok: false, error: "Informe a data de início." };
  if (!(input.prazoMeses >= 1 && input.prazoMeses <= 12))
    return { ok: false, error: "Prazo deve ser entre 1 e 12 meses." };
  if (!(input.orcamentoMensal >= 0)) return { ok: false, error: "Orçamento inválido." };
  if (!(input.qtdOcupantes >= 1)) return { ok: false, error: "Informe o número de ocupantes." };
  if (!isMotivo(input.motivo)) return { ok: false, error: "Selecione um motivo válido." };
  if (input.apresentacao && contemContato(input.apresentacao))
    return { ok: false, error: CONTATO_AVISO };

  // Limite anti-abuso: no máximo 2 pedidos ativos por inquilino.
  const { count } = await supabase
    .from("pedidos_moradia")
    .select("id", { count: "exact", head: true })
    .eq("inquilino_id", user.id)
    .eq("status", "ativo");
  if ((count ?? 0) >= MAX_PEDIDOS_ATIVOS)
    return {
      ok: false,
      error: `Você já tem ${MAX_PEDIDOS_ATIVOS} pedidos ativos. Pause ou marque um como atendido para publicar outro.`,
    };

  const { data, error } = await supabase
    .from("pedidos_moradia")
    .insert({
      inquilino_id: user.id,
      cidade,
      uf: input.uf ?? null,
      data_inicio: input.dataInicio,
      prazo_meses: Math.round(input.prazoMeses),
      orcamento_mensal: input.orcamentoMensal,
      qtd_ocupantes: Math.round(input.qtdOcupantes),
      motivo: input.motivo,
      apresentacao: input.apresentacao?.trim() || null,
      // expira_em é preenchido pelo trigger set_pedido_expira_em.
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id };
}

/** Meus pedidos (inquilino). Best-effort: [] em demo/sem sessão. */
export async function getMeusPedidos() {
  const supabase = await createClient();
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  // Roda a expiração lazy antes de listar (o pg_cron cobre quando ninguém abre).
  try {
    await supabase.rpc("expira_pedidos_moradia");
  } catch {
    /* best-effort */
  }
  const { data } = await supabase
    .from("pedidos_moradia")
    .select("*")
    .eq("inquilino_id", user.id)
    .order("criado_em", { ascending: false });
  return data ?? [];
}

/** Respostas recebidas nos meus pedidos (inquilino), com o imóvel ofertado. */
export async function getRespostasRecebidas() {
  const supabase = await createClient();
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("respostas_pedido")
    .select("*, properties(id, title, city, monthly_price)")
    .order("criado_em", { ascending: false });
  // A RLS já limita às respostas dos pedidos do inquilino (e às suas, se for dono).
  return data ?? [];
}

/**
 * Inquilino ACEITA uma resposta para conversar: marca a resposta e abre o thread
 * INTERNO de mensagens (tabela `messages`) com o proprietário, sobre o imóvel
 * ofertado. A partir daí segue o fluxo normal (ver imóvel → candidatura). A
 * revelação do nome do inquilino ao proprietário é liberada pela função
 * `pedido_inquilino` (só após este aceite).
 */
export async function aceitarResposta(respostaId: string): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para aceitar." };

  const { data: resposta, error: rErr } = await supabase
    .from("respostas_pedido")
    .select("id, pedido_id, proprietario_id, imovel_id")
    .eq("id", respostaId)
    .maybeSingle();
  if (rErr) return { ok: false, error: rErr.message };
  if (!resposta) return { ok: false, error: "Resposta não encontrada." };

  const { error: uErr } = await supabase
    .from("respostas_pedido")
    .update({ status: "aceita_para_conversa" })
    .eq("id", respostaId);
  if (uErr) return { ok: false, error: uErr.message };

  // Abre a conversa interna (mesma convenção de conversation_id do requestLead).
  const ownerId = resposta.proprietario_id as string;
  const imovelId = resposta.imovel_id as string;
  const conversationId = [user.id, ownerId].sort().join("_") + `_${imovelId}`;
  const body = guardContactInfo(
    "Aceitei sua resposta ao meu pedido de moradia. Podemos conversar por aqui?"
  ).text;
  await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      receiver_id: ownerId,
      property_id: imovelId,
      body,
    })
    .then(undefined, () => {});

  return { ok: true, id: respostaId };
}

/** Inquilino RECUSA uma resposta (motivo opcional; em branco não é exposto). */
export async function recusarResposta(respostaId: string, motivo?: string): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const limpo = (motivo ?? "").trim();
  if (limpo && detectarContato(limpo)) return { ok: false, error: CONTATO_AVISO };
  const { error } = await supabase
    .from("respostas_pedido")
    .update({ status: "recusada", recusa_motivo: limpo || null })
    .eq("id", respostaId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: respostaId };
}

/** Inquilino marca o pedido como atendido (a qualquer momento). */
export async function marcarAtendido(pedidoId: string): Promise<ActionResult> {
  return setPedidoStatus(pedidoId, "atendido");
}

/** Inquilino pausa/reativa um pedido. */
export async function pausarPedido(pedidoId: string, pausar: boolean): Promise<ActionResult> {
  return setPedidoStatus(pedidoId, pausar ? "pausado" : "ativo");
}

async function setPedidoStatus(pedidoId: string, status: string): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const { error } = await supabase
    .from("pedidos_moradia")
    .update({ status })
    .eq("id", pedidoId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: pedidoId };
}
