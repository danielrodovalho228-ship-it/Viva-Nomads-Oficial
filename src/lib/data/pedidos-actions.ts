"use server";

import { createClient } from "@/lib/supabase/server";
import { guardContactInfo } from "@/lib/messages/contact-guard";
import { listMyProperties } from "@/lib/data/properties";
import { notify } from "@/lib/notifications";
import {
  detalheNovoPedido,
  detalheResposta,
  detalheAceito,
  detalheExpirando,
} from "@/lib/pedidos/notify-templates";
import {
  contemContato,
  detectarContato,
  isMotivo,
  CONTATO_AVISO,
  MAX_PEDIDOS_ATIVOS,
} from "@/lib/pedidos/pedidos";

/** Aviso in-app + e-mail (+ WhatsApp adapter, se opt-in). Best-effort. */
type Recip = {
  email?: string | null;
  phone?: string | null;
  full_name?: string | null;
  notif_whatsapp?: boolean | null;
};
async function notificar(
  event:
    | "pedido_novo_cidade"
    | "pedido_resposta"
    | "pedido_aceito"
    | "pedido_expirando",
  r: Recip,
  detalhe: { detailsHtml: string; detailsText: string }
) {
  if (!r?.email) return;
  try {
    await notify({
      event,
      email: r.email,
      // WhatsApp é canal de SAÍDA e opt-in (adapter em modo demo sem config).
      phone: r.notif_whatsapp === false ? undefined : r.phone ?? undefined,
      name: r.full_name ?? undefined,
      detailsHtml: detalhe.detailsHtml,
      detailsText: detalhe.detailsText,
    });
  } catch {
    /* notificação nunca quebra o fluxo */
  }
}

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

  // (a) Avisa proprietários com imóvel ativo na cidade (opt-in). Best-effort.
  try {
    const { data: donos } = await supabase.rpc("pedido_owner_recipients", {
      cidade_alvo: cidade,
    });
    const detalhe = detalheNovoPedido(cidade);
    for (const d of (donos ?? []) as Recip[]) await notificar("pedido_novo_cidade", d, detalhe);
  } catch {
    /* best-effort */
  }

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
  const pedidos = data ?? [];

  // (d) Lembrete de expiração (3 dias antes), uma vez por pedido. Best-effort:
  // o próprio inquilino é o destinatário (lê o próprio perfil).
  try {
    const agora = Date.now();
    const em3dias = agora + 3 * 24 * 60 * 60 * 1000;
    const aExpirar = pedidos.filter(
      (p: Record<string, unknown>) =>
        p.status === "ativo" &&
        !p.lembrete_expira_em &&
        p.expira_em &&
        Date.parse(String(p.expira_em)) <= em3dias &&
        Date.parse(String(p.expira_em)) > agora
    );
    if (aExpirar.length > 0) {
      const { data: me } = await supabase
        .from("profiles")
        .select("full_name, email, phone, notif_email, notif_whatsapp")
        .eq("id", user.id)
        .maybeSingle();
      if (me?.notif_email !== false) {
        for (const p of aExpirar) {
          await notificar("pedido_expirando", me as Recip, detalheExpirando());
          await supabase
            .from("pedidos_moradia")
            .update({ lembrete_expira_em: new Date().toISOString() })
            .eq("id", (p as Record<string, unknown>).id as string);
        }
      }
    }
  } catch {
    /* best-effort */
  }

  return pedidos;
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

  // (c) Avisa o proprietário que sua resposta foi aceita (via RPC do imóvel).
  try {
    const { data: rpc } = await supabase.rpc("owner_notify_contact", { prop_id: imovelId });
    const o = Array.isArray(rpc) ? rpc[0] : rpc;
    if (o?.email) await notificar("pedido_aceito", o as Recip, detalheAceito());
  } catch {
    /* best-effort */
  }

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

// ── Preferências de notificação (in-app não desliga) ─────────────────────────

export async function getNotifPrefs(): Promise<{ email: boolean; whatsapp: boolean }> {
  const supabase = await createClient();
  if (!supabase) return { email: true, whatsapp: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { email: true, whatsapp: true };
  const { data } = await supabase
    .from("profiles")
    .select("notif_email, notif_whatsapp")
    .eq("id", user.id)
    .maybeSingle();
  return {
    email: data?.notif_email ?? true,
    whatsapp: data?.notif_whatsapp ?? true,
  };
}

export async function setNotifPrefs(prefs: {
  email: boolean;
  whatsapp: boolean;
}): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para alterar preferências." };
  const { error } = await supabase
    .from("profiles")
    .update({ notif_email: prefs.email, notif_whatsapp: prefs.whatsapp })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── Fluxo do proprietário ────────────────────────────────────────────────────

export interface PropriedadeMinima {
  id: string;
  title: string;
  city: string;
  maxGuests?: number;
  monthlyPrice: number;
}

/**
 * Pedidos ativos para o proprietário: lê a VIEW `pedidos_publicos` (só colunas
 * seguras — sem identidade do inquilino) e prioriza as cidades onde o dono tem
 * imóvel PUBLICADO. Devolve também os imóveis publicados do dono, para o cliente
 * casar capacidade × ocupantes e oferecer "Responder com meu imóvel" (ou o CTA
 * de captação quando não há imóvel na cidade).
 */
export async function getPedidosParaProprietario(): Promise<{
  pedidos: Record<string, unknown>[];
  myProperties: PropriedadeMinima[];
}> {
  const supabase = await createClient();
  if (!supabase) return { pedidos: [], myProperties: [] };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { pedidos: [], myProperties: [] };

  // Expiração lazy antes de listar.
  try {
    await supabase.rpc("expira_pedidos_moradia");
  } catch {
    /* best-effort */
  }

  const props = (await listMyProperties()).filter((p) => p.status === "active");
  const myProperties: PropriedadeMinima[] = props.map((p) => ({
    id: p.id,
    title: p.title,
    city: p.city,
    maxGuests: p.maxGuests,
    monthlyPrice: p.monthlyPrice,
  }));
  const cidades = new Set(props.map((p) => p.city.toLowerCase()));

  const { data } = await supabase
    .from("pedidos_publicos")
    .select("*")
    .order("criado_em", { ascending: false });
  const todos = (data ?? []) as Record<string, unknown>[];
  // Prioriza as cidades do dono; se ele não tem imóvel, mostra todos (captação).
  const pedidos =
    cidades.size === 0
      ? todos
      : todos.filter((p) => cidades.has(String(p.cidade ?? "").toLowerCase()));

  return { pedidos, myProperties };
}

/** Respostas que EU (proprietário) enviei, com o imóvel e o status. */
export async function getMinhasRespostas(): Promise<Record<string, unknown>[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("respostas_pedido")
    .select("*, properties(id, title, city, monthly_price)")
    .eq("proprietario_id", user.id)
    .order("criado_em", { ascending: false });
  return data ?? [];
}

/**
 * Proprietário RESPONDE um pedido com um imóvel seu. Validação no SERVIDOR:
 * o imóvel é dele e está publicado (também exigido pela RLS), e a capacidade do
 * imóvel comporta os ocupantes do pedido. Filtro anti-contato na mensagem.
 * A unicidade (um imóvel por pedido) é garantida pela constraint do banco.
 */
export async function responderPedido(
  pedidoId: string,
  imovelId: string,
  mensagem?: string
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para responder." };

  const msg = (mensagem ?? "").trim();
  if (msg && detectarContato(msg)) return { ok: false, error: CONTATO_AVISO };

  // Pedido precisa estar ATIVO (lido pela view pública) — e traz os ocupantes.
  const { data: pedido } = await supabase
    .from("pedidos_publicos")
    .select("id, qtd_ocupantes")
    .eq("id", pedidoId)
    .maybeSingle();
  if (!pedido) return { ok: false, error: "Pedido não está mais disponível." };

  // Imóvel precisa ser do dono e estar publicado; capacidade ≥ ocupantes.
  const { data: imovel } = await supabase
    .from("properties")
    .select("id, owner_id, status, max_guests")
    .eq("id", imovelId)
    .maybeSingle();
  if (!imovel || imovel.owner_id !== user.id)
    return { ok: false, error: "Selecione um imóvel seu." };
  if (imovel.status !== "active")
    return { ok: false, error: "O imóvel precisa estar publicado para responder." };
  const capacidade = imovel.max_guests as number | null;
  const ocupantes = pedido.qtd_ocupantes as number;
  if (capacidade != null && capacidade < ocupantes)
    return {
      ok: false,
      error: `Este imóvel comporta até ${capacidade} pessoas; o pedido é para ${ocupantes}.`,
    };

  const { error } = await supabase.from("respostas_pedido").insert({
    pedido_id: pedidoId,
    proprietario_id: user.id,
    imovel_id: imovelId,
    mensagem: msg || null,
  });
  if (error) {
    // 23505 = já respondeu este pedido com este imóvel (constraint única).
    if (error.code === "23505")
      return { ok: false, error: "Você já respondeu este pedido com esse imóvel." };
    return { ok: false, error: error.message };
  }

  // (b) Avisa o inquilino da nova resposta (RPC libera o contato só porque este
  // proprietário acabou de responder — nunca expõe o e-mail ao cliente).
  try {
    const { data: rcp } = await supabase.rpc("pedido_inquilino_recipient", { pedido: pedidoId });
    const inq = Array.isArray(rcp) ? rcp[0] : rcp;
    if (inq?.email) await notificar("pedido_resposta", inq as Recip, detalheResposta());
  } catch {
    /* best-effort */
  }

  return { ok: true };
}
