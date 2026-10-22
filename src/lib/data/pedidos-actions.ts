"use server";

import { createClient } from "@/lib/supabase/server";
import { sessaoAal2 } from "@/lib/data/admin-guard";
import { notificacaoLigada } from "@/lib/notifications/preferencias";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumirLimite, DIA } from "@/lib/limites";
import { guardContactInfo } from "@/lib/messages/contact-guard";
import { conversationId as idConversa } from "@/lib/messages/conversation-id";
import { listMyProperties } from "@/lib/data/properties";
import { notify } from "@/lib/notifications";
import { avisarCompativeisDoPedido, paresCompat } from "@/lib/data/pedidos-compat";
import { destinoParaDono, localDaEntrada } from "@/lib/data/local-trabalho";
import { temposAte } from "@/lib/data/tempos";
import { chaveDestino, ehModo, minutosArredondados } from "@/lib/rotas/tempo";
import { melhorPor, porQueCombina, type ImovelCompativel } from "@/lib/pedidos/compatibilidade";
import {
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
  PRAZO_MAX_MESES,
} from "@/lib/pedidos/pedidos";
import { cidadeOficial } from "@/lib/municipios";
import { APRESENTACAO_MAX } from "@/lib/pedidos/formulario";
import { chaveCidade } from "@/lib/cidades";
import { erroBancoPT } from "@/lib/erros-banco";
import { deveAvisarRenovar, validarCamposNovos, type CamposNovosValidos } from "@/lib/pedidos/campos";
import { abaDoPedido, MENSAGEM_OFERTA_PADRAO, type AbaDono } from "@/lib/pedidos/mural-dono";
import { selosDoPedido, type SeloPedido } from "@/lib/pedidos/confirmacao";
import { estadosIdentidade } from "@/lib/identidade/estado-servidor";
import { primeiroNome } from "@/lib/display-name";
import { lerChaveSms } from "@/lib/data/chave-sms";
import { signAvatarPath } from "@/lib/data/avatar-url";

/** Aviso in-app + e-mail (Prompt 30, item 8: sem WhatsApp). Best-effort. */
type Recip = {
  email?: string | null;
  full_name?: string | null;
  /** Id do perfil destinatário — habilita o push (quando disponível). */
  id?: string | null;
};

type PedidoEvent = "pedido_resposta" | "pedido_aceito" | "pedido_expirando";

/** Deep-link interno do push por evento. */
const PUSH_URL: Record<PedidoEvent, string> = {
  pedido_resposta: "/dashboard/pedidos",
  pedido_aceito: "/dashboard/mensagens",
  pedido_expirando: "/dashboard/pedidos",
};

async function notificar(
  event: PedidoEvent,
  r: Recip,
  detalhe: { detailsHtml: string; detailsText: string }
) {
  if (!r?.email) return;
  try {
    await notify({
      event,
      email: r.email,
      name: r.full_name ?? undefined,
      userId: r.id ?? undefined,
      pushUrl: PUSH_URL[event],
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
  /** O pedido inclui pet / crianças (só compatível com anúncio que aceita). */
  pets?: boolean;
  criancas?: boolean;
  /** Prompt 30: bairros (até 3; vazio = qualquer bairro), quartos mínimos, faixa de valor, necessidades e porte do pet. */
  bairros?: string[];
  quartosMin?: number | null;
  orcamentoMin?: number | null;
  necessidades?: string[];
  portePet?: string | null;
  /** Prompt 57 fase 2: download medido mínimo (50, 100 ou 300 Mbps). */
  internetMinMbps?: number | null;
  /** Prompt 37: onde vai trabalhar ou estudar, meio e "até N min" (padrão: o local de trabalho salvo na conta). */
  destino?: { destinoSlug?: string; lat?: number; lng?: number; rotulo?: string; modo?: string; ate?: number } | null;
}

type CamposValidados = {
  cidade: string;
  uf: string;
  campos: CamposNovosValidos;
};

/** Validação do SERVIDOR, a mesma para publicar e editar. */
function validarPedido(input: PedidoInput): { ok: true; v: CamposValidados } | { ok: false; error: string } {
  if (!(input.cidade ?? "").trim()) return { ok: false, error: "Informe a cidade." };
  const oficial = cidadeOficial(input.cidade ?? "", input.uf ?? "");
  if (!oficial) return { ok: false, error: "Escolha a UF e uma cidade da lista." };
  if (!input.dataInicio) return { ok: false, error: "Informe a data de início." };
  if (!(input.prazoMeses >= 1 && input.prazoMeses <= PRAZO_MAX_MESES))
    return { ok: false, error: `Prazo deve ser entre 1 e ${PRAZO_MAX_MESES} meses (30 a 180 dias).` };
  if (!(input.orcamentoMensal > 0)) return { ok: false, error: "Informe o valor mensal máximo." };
  if (!(input.qtdOcupantes >= 1)) return { ok: false, error: "Informe o número de ocupantes." };
  if (!isMotivo(input.motivo)) return { ok: false, error: "Selecione um motivo válido." };
  if (input.apresentacao && contemContato(input.apresentacao)) return { ok: false, error: CONTATO_AVISO };
  if ((input.apresentacao ?? "").length > APRESENTACAO_MAX)
    return { ok: false, error: `A apresentação tem até ${APRESENTACAO_MAX} caracteres.` };
  if ((input.bairros ?? []).some((b) => contemContato(b))) return { ok: false, error: CONTATO_AVISO };
  const c = validarCamposNovos(input, { orcamentoMax: input.orcamentoMensal, pets: !!input.pets });
  if (!c.ok) return { ok: false, error: c.erro };
  return { ok: true, v: { cidade: oficial.cidade, uf: oficial.uf, campos: c.valor } };
}

/** Colunas gravadas a partir do formulário (publicar e editar). */
function colunasDoPedido(input: PedidoInput, v: CamposValidados) {
  return {
    cidade: v.cidade,
    uf: v.uf,
    data_inicio: input.dataInicio,
    prazo_meses: Math.round(input.prazoMeses),
    orcamento_mensal: input.orcamentoMensal,
    orcamento_min: v.campos.orcamentoMin,
    qtd_ocupantes: Math.round(input.qtdOcupantes),
    motivo: input.motivo,
    apresentacao: input.apresentacao?.trim() || null,
    pets: !!input.pets,
    porte_pet: v.campos.portePet,
    criancas: !!input.criancas,
    bairros: v.campos.bairros,
    quartos_min: v.campos.quartosMin,
    necessidades: v.campos.necessidades,
    internet_min_mbps: v.campos.internetMinMbps,
  };
}

/** Prompt 37: destino do pedido validado no servidor (slug ativo ou endereço escolhido); sem admin, sem destino. */
async function destinoDoPedido(input: PedidoInput) {
  const admin = createAdminClient();
  return admin ? localDaEntrada(admin, input.destino ?? null) : null;
}

/**
 * Prompt 37: com "até N min", a compatibilidade lê o tempo do cache. Calcula agora os que faltam para os imóveis
 * mais próximos da cidade (o cron completa o resto). Best-effort.
 */
async function prepararTemposDoPedido(pedidoId: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  const { data: ped } = await admin.from("pedidos_moradia").select("cidade, destino").eq("id", pedidoId).maybeSingle();
  const d = ped?.destino as { destino_id?: string; lat: number; lng: number; rotulo: string; modo_preferido?: string; ate?: number } | null;
  if (!d?.ate) return;
  const destino = {
    chave: chaveDestino(d.destino_id ? { destinoId: d.destino_id } : { lat: Number(d.lat), lng: Number(d.lng) }),
    ponto: { lat: Number(d.lat), lng: Number(d.lng) },
    rotulo: d.rotulo,
    destinoId: d.destino_id,
  };
  const { data: daCidade } = await admin.from("properties").select("id").eq("status", "active").ilike("city", String(ped?.cidade ?? ""));
  const modo = ehModo(d.modo_preferido) ? d.modo_preferido : "carro";
  await temposAte(destino, modo, { ids: ((daCidade ?? []) as { id: string }[]).map((p) => p.id) }, admin);
}

/**
 * Cria um Pedido de Moradia (fluxo do inquilino). Valida no SERVIDOR: campos
 * obrigatórios, filtro anti-contato na apresentação (bloqueia telefone/e-mail/
 * mensageria) e limite de 2 pedidos ativos. Best-effort: no-op em demo/sem sessão.
 */
const PEDIDOS_POR_DIA = 3;

export async function criarPedido(
  input: PedidoInput
): Promise<ActionResult & { compativeis?: number; sugestao?: string | null; imoveis?: ImovelCompativel[]; chegaAosDonos?: boolean; falta?: ("e-mail" | "telefone")[]; smsLigado?: boolean }> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para publicar um pedido." };

  // Validações de servidor (fonte da verdade). Cidade OFICIAL (lista do IBGE, com acento) — "Uberlandia" vira
  // "Uberlândia" e não divide a mesma cidade em duas.
  const val = validarPedido(input);
  if (!val.ok) return { ok: false, error: val.error };

  // Limite por dia (cada pedido avisa proprietários por e-mail): sem ele,
  // publicar/pausar em loop disparava avisos sem fim. Falha fechada.
  if (!(await consumirLimite(`pedido:${user.id}`, PEDIDOS_POR_DIA, DIA)))
    return {
      ok: false,
      error: `Você já publicou ${PEDIDOS_POR_DIA} pedidos hoje. Tente novamente amanhã.`,
    };

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

  const destino = await destinoDoPedido(input);
  if (destino === "invalido") return { ok: false, error: "Escolha o local de trabalho na lista de sugestões." };

  const { data, error } = await supabase
    .from("pedidos_moradia")
    .insert({
      inquilino_id: user.id,
      ...colunasDoPedido(input, val.v),
      destino,
      // expira_em é preenchido pelo trigger set_pedido_expira_em (30 dias, nunca antes da entrada — 0184).
    })
    .select("id, cidade")
    .single();
  if (error || !data) return { ok: false, error: erroBancoPT(error, "Falha ao publicar o pedido.") };

  // (a) Avisa SÓ os donos com imóvel COMPATÍVEL (regra do banco, 0064) — antes
  // ia para todos os donos da cidade. Devolve quantos imóveis combinam agora.
  let compat: Awaited<ReturnType<typeof avisarCompativeisDoPedido>> = {
    compativeis: 0,
    sugestao: null,
    imoveis: [],
    chegaAosDonos: false,
    falta: [],
    smsLigado: false,
  };
  try {
    await prepararTemposDoPedido(data.id as string);
    compat = await avisarCompativeisDoPedido(data.id as string);
  } catch {
    /* best-effort: o pedido já foi publicado */
  }

  return { ok: true, id: data?.id, ...compat };
}

/** Um pedido MEU, para editar (inquilino). null se não é meu ou não existe. */
export async function getMeuPedido(pedidoId: string): Promise<Record<string, unknown> | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("pedidos_moradia").select("*").eq("id", pedidoId).eq("inquilino_id", user.id).maybeSingle();
  if (!data || ["excluido", "removido_admin"].includes(String(data.status))) return null;
  return data as Record<string, unknown>;
}

/**
 * Editar (Prompt 30, item 4): os mesmos campos, revalidados no servidor; recalcula a compatibilidade
 * (compativeis_ao_publicar) e avisa só os donos novos que passaram a combinar (o aviso é único por pedido e dono).
 */
export async function editarPedido(pedidoId: string, input: PedidoInput): Promise<ActionResult & { compativeis?: number }> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para editar o pedido." };
  const val = validarPedido(input);
  if (!val.ok) return { ok: false, error: val.error };
  const destino = await destinoDoPedido(input);
  if (destino === "invalido") return { ok: false, error: "Escolha o local de trabalho na lista de sugestões." };
  const { data, error } = await supabase
    .from("pedidos_moradia")
    .update({ ...colunasDoPedido(input, val.v), destino })
    .eq("id", pedidoId)
    .eq("inquilino_id", user.id)
    .in("status", ["ativo", "pausado"])
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: erroBancoPT(error, "Não foi possível salvar o pedido.") };
  if (!data) return { ok: false, error: "Este pedido não pode mais ser editado." };
  let compativeis = 0;
  try {
    await prepararTemposDoPedido(pedidoId);
    compativeis = (await avisarCompativeisDoPedido(pedidoId)).compativeis;
  } catch {
    /* best-effort */
  }
  return { ok: true, id: pedidoId, compativeis };
}

/**
 * Excluir (Prompt 30, item 4): some para os donos na hora; as respostas em andamento recebem aviso; o histórico fica
 * só para a equipe (status 'excluido', a linha não é apagada).
 */
export async function excluirPedido(pedidoId: string): Promise<ActionResult & { avisados?: number }> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para excluir o pedido." };
  const { data, error } = await supabase
    .from("pedidos_moradia")
    .update({ status: "excluido", excluido_em: new Date().toISOString() })
    .eq("id", pedidoId)
    .eq("inquilino_id", user.id)
    .not("status", "in", "(excluido,removido_admin)")
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: erroBancoPT(error, "Não foi possível excluir o pedido.") };
  if (!data) return { ok: false, error: "Pedido não encontrado." };
  let avisados = 0;
  try {
    const admin = createAdminClient();
    if (admin) {
      const { data: resps } = await admin
        .from("respostas_pedido")
        .select("proprietario_id, status")
        .eq("pedido_id", pedidoId)
        .in("status", ["enviada", "vista", "aceita_para_conversa"]);
      const donos = [...new Set(((resps ?? []) as { proprietario_id: string }[]).map((r) => r.proprietario_id))];
      for (const donoId of donos) {
        const { data: perfil } = await admin.from("profiles").select("email, full_name, notif_email").eq("id", donoId).maybeSingle();
        if (!perfil?.email || perfil.notif_email === false) continue;
        await notify({
          event: "pedido_encerrado",
          email: perfil.email as string,
          name: (perfil.full_name as string) ?? undefined,
          userId: donoId,
          pushUrl: "/dashboard/pedidos-cidade",
        }).catch(() => {});
        avisados += 1;
      }
    }
  } catch {
    /* best-effort: o pedido já saiu do ar */
  }
  return { ok: true, id: pedidoId, avisados };
}

/** Renovar com um clique: mais 30 dias a partir de agora (nunca antes da entrada). Expirado volta a ativo. */
export async function renovarPedido(pedidoId: string): Promise<ActionResult & { expiraEm?: string }> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para renovar o pedido." };
  const { data, error } = await supabase
    .from("pedidos_moradia")
    .update({ renovado_em: new Date().toISOString(), status: "ativo", aviso_renovar_em: null })
    .eq("id", pedidoId)
    .eq("inquilino_id", user.id)
    .in("status", ["ativo", "pausado", "expirado"])
    .select("id, expira_em")
    .maybeSingle();
  if (error) return { ok: false, error: erroBancoPT(error, "Não foi possível renovar o pedido.") };
  if (!data) return { ok: false, error: "Este pedido não pode ser renovado." };
  return { ok: true, id: pedidoId, expiraEm: data.expira_em as string };
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
    await createAdminClient()?.rpc("expira_pedidos_moradia"); // só o servidor executa (0070)
  } catch {
    /* best-effort */
  }
  const { data } = await supabase
    .from("pedidos_moradia")
    .select("*")
    .eq("inquilino_id", user.id)
    .neq("status", "excluido")
    .order("criado_em", { ascending: false });
  const pedidos = data ?? [];

  // (d) Aviso de renovação (Prompt 30): 5 dias antes de expirar, uma vez por ciclo ("Ainda procurando? Renove com um
  // clique"). Best-effort: o próprio inquilino é o destinatário (lê o próprio perfil).
  try {
    const agora = new Date();
    const aExpirar = pedidos.filter((p: Record<string, unknown>) =>
      deveAvisarRenovar(
        {
          status: String(p.status),
          expiraEm: (p.expira_em as string | null) ?? null,
          avisoRenovarEm: (p.aviso_renovar_em as string | null) ?? null,
          renovadoEm: (p.renovado_em as string | null) ?? null,
        },
        agora,
      ),
    );
    if (aExpirar.length > 0) {
      const { data: me } = await supabase
        .from("profiles")
        .select("full_name, email, notif_email")
        .eq("id", user.id)
        .maybeSingle();
      if (me?.notif_email !== false) {
        for (const p of aExpirar) {
          await notificar("pedido_expirando", me as Recip, detalheExpirando());
          await supabase
            .from("pedidos_moradia")
            .update({ lembrete_expira_em: new Date().toISOString(), aviso_renovar_em: new Date().toISOString() })
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
    .select("*, properties(id, title, city, monthly_price, condo_fee, utilities_mode, utilities_estimate, available_from)")
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
  if (rErr) return { ok: false, error: erroBancoPT(rErr) };
  if (!resposta) return { ok: false, error: "Resposta não encontrada." };

  const { error: uErr } = await supabase
    .from("respostas_pedido")
    .update({ status: "aceita_para_conversa" })
    .eq("id", respostaId);
  if (uErr) return { ok: false, error: erroBancoPT(uErr) };

  // Abre a conversa interna (mesmo id do requestLead: pessoas + imóvel).
  const ownerId = resposta.proprietario_id as string;
  const imovelId = resposta.imovel_id as string;
  const conversationId = idConversa(user.id, ownerId, imovelId);
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
    .then(
      ({ error }) => {
        if (error) console.error("[aceitarResposta] falha ao abrir conversa:", error.code, error.message);
      },
      (e) => console.error("[aceitarResposta] falha ao abrir conversa:", e)
    );

  // (c) Avisa o proprietário que sua resposta foi aceita (via RPC do imóvel).
  try {
    // C3: RPC de contato (PII) só via service role no servidor.
    const admin = createAdminClient();
    const { data: rpc } = admin
      ? await admin.rpc("owner_notify_contact", { prop_id: imovelId })
      : { data: null };
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
  if (error) return { ok: false, error: erroBancoPT(error) };
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
  if (error) return { ok: false, error: erroBancoPT(error) };
  return { ok: true, id: pedidoId };
}

// ── Preferências de notificação (in-app não desliga) ─────────────────────────

/** Preferência de aviso por e-mail (o aviso no app não desliga). Prompt 30, item 8: não há mais aviso por WhatsApp. */
export async function getNotifPrefs(): Promise<{ email: boolean }> {
  const supabase = await createClient();
  if (!supabase) return { email: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { email: true };
  const { data } = await supabase.from("profiles").select("notif_email").eq("id", user.id).maybeSingle();
  // Critério 5: sem preferência salva = ligado.
  return { email: notificacaoLigada(data?.notif_email) };
}

export async function setNotifPrefs(prefs: { email: boolean }): Promise<ActionResult> {
  if (typeof prefs?.email !== "boolean") return { ok: false, error: "Valor inválido." };
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para alterar preferências." };
  const { error } = await supabase
    .from("profiles")
    .update({ notif_email: prefs.email })
    .eq("id", user.id);
  if (error) return { ok: false, error: erroBancoPT(error) };
  return { ok: true };
}

/**
 * "Receber alertas da equipe" (documento na fila, chamado, parceiro): só para admin (ordem 27cfd36a).
 * Devolve null para quem não é admin, então a tela nem mostra o interruptor.
 */
export async function getAlertasEquipe(): Promise<boolean | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("role, recebe_alertas_operacionais").eq("id", user.id).maybeSingle();
  if (data?.role !== "admin") return null;
  return data.recebe_alertas_operacionais === true;
}

/** Liga/desliga os alertas operacionais do PRÓPRIO admin. A coluna não é editável pelo usuário: grava pelo servidor depois de checar o papel. */
export async function setAlertasEquipe(ligado: boolean): Promise<ActionResult> {
  if (typeof ligado !== "boolean") return { ok: false, error: "Valor inválido." };
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para alterar preferências." };
  const { data: eu } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (eu?.role !== "admin" || !(await sessaoAal2(supabase))) return { ok: false, error: "Só a equipe pode alterar isto." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Não foi possível salvar agora. Tente de novo." };
  const { error } = await admin.from("profiles").update({ recebe_alertas_operacionais: ligado }).eq("id", user.id);
  if (error) return { ok: false, error: erroBancoPT(error) };
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

/** Uma linha do mural do dono (Prompt 30): os campos do pedido, os selos e a aba. Nunca contato. */
export interface PedidoParaDono {
  id: string;
  cidade: string;
  uf: string | null;
  data_inicio: string;
  prazo_meses: number;
  orcamento_min: number | null;
  orcamento_mensal: number;
  qtd_ocupantes: number;
  motivo: string;
  apresentacao: string | null;
  criado_em: string;
  expira_em: string;
  pets: boolean;
  porte_pet: string | null;
  criancas: boolean;
  bairros: string[];
  quartos_min: number | null;
  internet_min_mbps: number | null;
  necessidades: string[];
  selos: SeloPedido[];
  situacao: "compativel" | "quase" | "demais";
  compat_imovel_id: string | null;
  compat_imovel_titulo: string | null;
  compat_nota: number | null;
  compat_motivo: string | null;
  compat_porque: string[];
  aba: AbaDono;
  minhaResposta: { status: string; imovelId: string; imovelTitulo: string; criadoEm: string } | null;
  ignoradoMotivo: string | null;
  /** Nome curto e foto: só depois que o inquilino aceita a sua resposta (identidade oculta até o aceite). */
  inquilino: { nome: string; fotoUrl: string | null } | null;
  /** O pedido saiu do ar (encerrado, excluído ou expirado) depois que você respondeu. */
  encerrado: boolean;
  /** Prompt 37: "perto do HC-UFU · ~15 min do seu imóvel" — só o rótulo e os minutos, nunca o endereço digitado. */
  destino: string | null;
}

/**
 * Mural do PROPRIETÁRIO (Prompt 30, item 5): lê pedidos_mural (a mesma regra de visibilidade da chave SMS_ATIVO,
 * com o e-mail do dono também confirmado), prioriza as cidades dos imóveis publicados do dono e separa em três abas:
 * "Novos para você", "Respondidos" (com o status da conversa) e "Ignorados". Antes a lista vinha vazia até para
 * pedido ativo já respondido: a 0160 escondia todo pedido sem telefone confirmado.
 */
export async function getPedidosParaProprietario(): Promise<{
  pedidos: PedidoParaDono[];
  myProperties: PropriedadeMinima[];
}> {
  const supabase = await createClient();
  if (!supabase) return { pedidos: [], myProperties: [] };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { pedidos: [], myProperties: [] };

  const admin = createAdminClient();
  try {
    await admin?.rpc("expira_pedidos_moradia"); // expiração lazy (só o servidor executa, 0070)
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
  const cidades = new Set(props.map((p) => chaveCidade(p.city)));

  const [{ data: mural }, { data: resps }, { data: ign }] = await Promise.all([
    supabase.rpc("pedidos_mural"),
    supabase
      .from("respostas_pedido")
      .select("pedido_id, imovel_id, status, criado_em, properties(title)")
      .eq("proprietario_id", user.id)
      .order("criado_em", { ascending: false }),
    supabase.from("pedidos_ignorados").select("pedido_id, motivo").eq("proprietario_id", user.id),
  ]);
  const todos = ((mural ?? []) as Record<string, unknown>[]).filter(
    (p) => cidades.size === 0 || cidades.has(chaveCidade(String(p.cidade ?? ""))),
  );
  const minhas = new Map<string, { status: string; imovelId: string; imovelTitulo: string; criadoEm: string }>();
  for (const r of (resps ?? []) as unknown as { pedido_id: string; imovel_id: string; status: string; criado_em: string; properties: { title: string } | null }[]) {
    if (!minhas.has(r.pedido_id)) minhas.set(r.pedido_id, { status: r.status, imovelId: r.imovel_id, imovelTitulo: r.properties?.title ?? "seu imóvel", criadoEm: r.criado_em });
  }
  const ignorados = new Map(((ign ?? []) as { pedido_id: string; motivo: string | null }[]).map((i) => [i.pedido_id, i.motivo]));

  // Pedidos que respondi e saíram do mural (encerrados/expirados) continuam em "Respondidos", com o mínimo.
  const noMural = new Set(todos.map((p) => String(p.id)));
  const foraDoMural = [...minhas.keys()].filter((id) => !noMural.has(id));
  const extras: Record<string, unknown>[] = [];
  if (admin && foraDoMural.length) {
    const { data } = await admin
      .from("pedidos_moradia")
      .select("id, cidade, uf, data_inicio, prazo_meses, orcamento_min, orcamento_mensal, qtd_ocupantes, motivo, criado_em, expira_em, pets, porte_pet, criancas, bairros, quartos_min, necessidades, internet_min_mbps")
      .in("id", foraDoMural);
    for (const p of (data ?? []) as Record<string, unknown>[]) extras.push({ ...p, apresentacao: null, email_confirmado: true, telefone_confirmado: false, encerrado: true });
  }
  const linhas = [...todos, ...extras];

  // Selos (identidade) e, depois do aceite, nome curto + foto — tudo pelo servidor; o id do inquilino nunca sai daqui.
  const inquilinoDe = new Map<string, string>();
  if (admin && linhas.length) {
    const { data } = await admin.from("pedidos_moradia").select("id, inquilino_id").in("id", linhas.map((p) => String(p.id)));
    for (const r of (data ?? []) as { id: string; inquilino_id: string }[]) inquilinoDe.set(r.id, r.inquilino_id);
  }
  const identidades = admin ? await estadosIdentidade(admin, [...new Set(inquilinoDe.values())]).catch(() => new Map()) : new Map();
  const aceitos = [...minhas.entries()].filter(([, r]) => r.status === "aceita_para_conversa").map(([pid]) => pid);
  const perfis = new Map<string, { nome: string; fotoUrl: string | null }>();
  if (admin && aceitos.length) {
    const ids = aceitos.map((pid) => inquilinoDe.get(pid)).filter((x): x is string => !!x);
    const { data } = await admin.from("profiles").select("id, full_name, avatar_url").in("id", ids);
    for (const pf of (data ?? []) as { id: string; full_name: string | null; avatar_url: string | null }[]) {
      perfis.set(pf.id, { nome: primeiroNome(pf.full_name) || "Inquilino(a)", fotoUrl: await signAvatarPath(pf.avatar_url, pf.id) });
    }
  }

  const pares = admin ? await paresCompat(admin, { dono: user.id }) : [];
  const melhor = melhorPor(pares, "pedido_id");
  const destinos = admin ? await destinosParaDono(admin, linhas.map((p) => String(p.id)), melhor) : new Map<string, string>();
  const pedidos: PedidoParaDono[] = linhas.map((p) => {
    const id = String(p.id);
    const par = melhor.get(id);
    const minha = minhas.get(id) ?? null;
    const inqId = inquilinoDe.get(id);
    const ignorado = ignorados.has(id);
    return {
      id,
      cidade: String(p.cidade ?? ""),
      uf: (p.uf as string | null) ?? null,
      data_inicio: String(p.data_inicio ?? ""),
      prazo_meses: Number(p.prazo_meses),
      orcamento_min: p.orcamento_min == null ? null : Number(p.orcamento_min),
      orcamento_mensal: Number(p.orcamento_mensal),
      qtd_ocupantes: Number(p.qtd_ocupantes),
      motivo: String(p.motivo ?? ""),
      apresentacao: (p.apresentacao as string | null) ?? null,
      criado_em: String(p.criado_em ?? ""),
      expira_em: String(p.expira_em ?? ""),
      pets: p.pets === true,
      porte_pet: (p.porte_pet as string | null) ?? null,
      criancas: p.criancas === true,
      bairros: (p.bairros as string[] | null) ?? [],
      quartos_min: p.quartos_min == null ? null : Number(p.quartos_min),
      internet_min_mbps: p.internet_min_mbps == null ? null : Number(p.internet_min_mbps),
      necessidades: (p.necessidades as string[] | null) ?? [],
      selos: selosDoPedido({
        emailConfirmado: p.email_confirmado === true,
        telefoneConfirmado: p.telefone_confirmado === true,
        identidadeConfirmada: !!inqId && identidades.get(inqId)?.estado === "confirmada",
      }),
      situacao: par?.situacao ?? "demais",
      compat_imovel_id: par && par.situacao !== "demais" ? par.imovel_id : null,
      compat_imovel_titulo: par && par.situacao !== "demais" ? par.titulo : null,
      compat_nota: par && par.situacao !== "demais" ? par.nota : null,
      compat_motivo: par?.situacao === "quase" ? par.motivo : null,
      compat_porque: par?.situacao === "compativel" ? porQueCombina(par) : [],
      aba: abaDoPedido({ respondido: !!minha, ignorado }),
      minhaResposta: minha,
      ignoradoMotivo: ignorados.get(id) ?? null,
      inquilino: minha?.status === "aceita_para_conversa" && inqId ? perfis.get(inqId) ?? null : null,
      encerrado: p.encerrado === true,
      destino: destinos.get(id) ?? null,
    };
  });
  return { pedidos, myProperties };
}

/** Prompt 37: texto do destino de cada pedido para o dono (rótulo + minutos até o imóvel dele que combina). */
async function destinosParaDono(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  ids: string[],
  melhor: Map<string, { imovel_id: string; situacao: string }>,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!ids.length) return out;
  const { data } = await admin.from("pedidos_moradia").select("id, destino").in("id", ids).not("destino", "is", null);
  const linhas = (data ?? []) as { id: string; destino: { destino_id?: string; rotulo: string; lat: number; lng: number; modo_preferido?: string } }[];
  const idsDestino = [...new Set(linhas.map((l) => l.destino.destino_id).filter((x): x is string => !!x))];
  const { data: ds } = idsDestino.length ? await admin.from("destinos").select("id, artigo").in("id", idsDestino) : { data: [] };
  const artigo = new Map(((ds ?? []) as { id: string; artigo: "o" | "a" | "" }[]).map((d) => [d.id, d.artigo]));
  for (const l of linhas) {
    const d = l.destino;
    const par = melhor.get(l.id);
    let min: number | null = null;
    if (par && par.situacao !== "demais") {
      const chave = chaveDestino(d.destino_id ? { destinoId: d.destino_id } : { lat: Number(d.lat), lng: Number(d.lng) });
      const { data: t } = await admin
        .from("tempos_deslocamento")
        .select("minutos")
        .eq("property_id", par.imovel_id)
        .eq("destino_chave", chave)
        .eq("modo", ehModo(d.modo_preferido) ? d.modo_preferido : "carro")
        .maybeSingle();
      if (t?.minutos != null) min = minutosArredondados(Number(t.minutos)) ?? 0;
    }
    out.set(l.id, destinoParaDono(d.rotulo, d.destino_id ? (artigo.get(d.destino_id) ?? "o") : null, min));
  }
  return out;
}

/** Ignorar um pedido (motivo opcional): sai de "Novos para você" e vai para "Ignorados". */
export async function ignorarPedido(pedidoId: string, motivo?: string): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para continuar." };
  const limpo = (motivo ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  if (limpo && detectarContato(limpo)) return { ok: false, error: CONTATO_AVISO };
  const { error } = await supabase
    .from("pedidos_ignorados")
    .upsert({ pedido_id: pedidoId, proprietario_id: user.id, motivo: limpo || null }, { onConflict: "pedido_id,proprietario_id" });
  if (error) return { ok: false, error: erroBancoPT(error) };
  return { ok: true, id: pedidoId };
}

/** Desfazer o "Ignorar": o pedido volta para "Novos para você". */
export async function voltarParaNovos(pedidoId: string): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para continuar." };
  const { error } = await supabase.from("pedidos_ignorados").delete().eq("pedido_id", pedidoId).eq("proprietario_id", user.id);
  if (error) return { ok: false, error: erroBancoPT(error) };
  return { ok: true, id: pedidoId };
}

/**
 * "Oferecer um imóvel": o dono escolhe um imóvel compatível e a resposta sai com a mensagem padrão (editável); o
 * inquilino vê o cartão do anúncio na resposta. É a mesma resposta de responderPedido (RLS, capacidade, anti-contato).
 */
export async function oferecerImovel(pedidoId: string, imovelId: string, mensagem?: string): Promise<ActionResult> {
  const texto = (mensagem ?? "").trim() || MENSAGEM_OFERTA_PADRAO;
  return responderPedido(pedidoId, imovelId, texto);
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
    .select("*, properties(id, title, city, monthly_price, condo_fee, utilities_mode, utilities_estimate, available_from)")
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

  const { data: respGravada, error } = await supabase
    .from("respostas_pedido")
    .insert({
      pedido_id: pedidoId,
      proprietario_id: user.id,
      imovel_id: imovelId,
      mensagem: msg || null,
    })
    .select("pedido_id")
    .single();
  if (error || !respGravada) {
    if (!error) return { ok: false, error: "Falha ao registrar a resposta." };
    // 23505 = já respondeu este pedido com este imóvel (constraint única).
    if (error.code === "23505")
      return { ok: false, error: "Você já respondeu este pedido com esse imóvel." };
    return { ok: false, error: erroBancoPT(error) };
  }

  // (b) Avisa o inquilino da nova resposta. C3: contato só no servidor (service
  // role). A relação já foi provada — o INSERT da resposta acima passou na RLS
  // (dono de imóvel ativo + pedido ativo). Nunca expõe o e-mail ao cliente.
  try {
    const admin = createAdminClient();
    if (admin) {
      const { data: p } = await admin
        .from("pedidos_moradia")
        .select("inquilino_id")
        // Pedido pela LINHA GRAVADA (resposta que passou na RLS), não pelo parâmetro.
        .eq("id", respGravada.pedido_id as string)
        .maybeSingle();
      const inqId = (p as { inquilino_id?: string } | null)?.inquilino_id;
      if (inqId) {
        const { data: inq } = await admin
          .from("profiles")
          .select("full_name, email")
          .eq("id", inqId)
          .maybeSingle();
        if (inq?.email) {
          await notificar("pedido_resposta", { ...(inq as Recip), id: inqId }, detalheResposta());
        }
      }
    }
  } catch {
    /* best-effort */
  }

  return { ok: true };
}

/** A chave SMS_ATIVO está ligada? Só o liga/desliga (os textos do formulário acompanham a chave). */
export async function chaveSmsLigada(): Promise<boolean> {
  return (await lerChaveSms()).ligada;
}

/**
 * Sino do dono (Prompt 30, item 5): pedidos compatíveis novos — avisados a ele, ainda ativos, sem resposta dele e não
 * ignorados. A lista de Notificações mostra o número e leva a "Novos para você".
 */
export async function pedidosNovosCompativeis(): Promise<{ total: number; recentes: { id: string; cidade: string; criadoEm: string }[] }> {
  const supabase = await createClient();
  if (!supabase) return { total: 0, recentes: [] };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = createAdminClient();
  if (!user || !admin) return { total: 0, recentes: [] };
  const { data: avisos } = await admin.from("pedido_avisos").select("pedido_id, criado_em").eq("dono_id", user.id).order("criado_em", { ascending: false }).limit(200);
  const ids = [...new Set(((avisos ?? []) as { pedido_id: string }[]).map((a) => a.pedido_id))];
  if (!ids.length) return { total: 0, recentes: [] };
  const [{ data: ativos }, { data: resps }, { data: ign }] = await Promise.all([
    admin.from("pedidos_moradia").select("id, cidade, criado_em").in("id", ids).eq("status", "ativo").gt("expira_em", new Date().toISOString()),
    admin.from("respostas_pedido").select("pedido_id").eq("proprietario_id", user.id).in("pedido_id", ids),
    admin.from("pedidos_ignorados").select("pedido_id").eq("proprietario_id", user.id).in("pedido_id", ids),
  ]);
  const fora = new Set([...((resps ?? []) as { pedido_id: string }[]), ...((ign ?? []) as { pedido_id: string }[])].map((r) => r.pedido_id));
  const novos = ((ativos ?? []) as { id: string; cidade: string; criado_em: string }[]).filter((p) => !fora.has(p.id));
  return { total: novos.length, recentes: novos.slice(0, 5).map((p) => ({ id: p.id, cidade: p.cidade, criadoEm: p.criado_em })) };
}
