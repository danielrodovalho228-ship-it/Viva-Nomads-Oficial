"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { conversationId } from "@/lib/messages/conversation-id";
import { guardContactInfo } from "@/lib/messages/contact-guard";
import { notify, type NotificationEvent } from "@/lib/notifications";
import { atribuicaoDoPedidoParceiro } from "@/lib/data/cartoes-servidor";
import { REF_COOKIE_PARCEIRO } from "@/lib/cartoes/compartilhar";
import { integracoesSimuladas } from "@/lib/integracoes";
import { PAGAMENTO_PARCEIROS_ATIVO } from "@/lib/flags";
import { logModeracao } from "@/lib/data/moderacao-log";
import { ehAdmin } from "@/lib/data/admin-guard";
import { dataHoraBRT } from "@/lib/datas-brasilia";
import { categoriaValida, rotuloCategoria } from "./regras";
import {
  CHAVE_CONVERSA_PEDIDO,
  congelarValores,
  MENSAGENS_AUTOMATICAS,
  MOTIVO_RECUSA_MAX,
  podeFazer,
  podeSimularPagamento,
  provedorSimulado,
  STATUS_ABERTOS,
  tetoAtingido,
  textoTeto,
  validarOrcamento,
  validarPedido,
  visaoDoParceiro,
  horarioNaAgenda,
  type AcaoPedido,
  type BloqueioAgenda,
  type JanelaAgenda,
  type PapelNoPedido,
} from "./pedido";

/*
  Contratação de parceiros (Prompt 31b). Toda escrita de status, valores e pagamento passa por aqui e grava com o
  cliente de serviço DEPOIS de conferir a sessão e a parte (cliente ou parceiro do pedido). Nenhum dinheiro passa
  pela Viva: o pagamento fica "indisponivel" (chave desligada) ou "simulado" (contas de teste).
*/

type Res<T = null> = { ok: true; valor: T } | { ok: false; erro: string };
type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALFABETO = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const BUCKET_ENTREGAS = "parceiro-entregas";
const URL_ASSINADA_SEG = 10 * 60;
const ARQUIVO_MAX = 25 * 1024 * 1024;
const TIPOS_ENTREGA = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf", "application/zip", "video/mp4"]);
const TIPOS_DOCUMENTO = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

const rota = (id: string) => `/dashboard/servicos/pedidos/${id}`;

function novoCodigo(): string {
  const b = randomBytes(8);
  return `VN-SV-${Array.from(b, (x) => ALFABETO[x % ALFABETO.length]).join("")}`;
}

async function sessao(): Promise<{ admin: Admin; userId: string } | { erro: string }> {
  const supabase = await createClient();
  if (!supabase) return { erro: "Entre para continuar." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Entre para continuar." };
  const admin = createAdminClient();
  if (!admin) return { erro: "Não foi possível continuar agora. Tente de novo em instantes." };
  return { admin, userId: user.id };
}

export interface LinhaPedido {
  id: string;
  codigo: string;
  parceiro_id: string;
  cliente_id: string;
  servico_id: string | null;
  property_id: string | null;
  categoria: string;
  descricao: string | null;
  status: string;
  horarios_propostos: string[] | null;
  horario_confirmado: string | null;
  valor_combinado: number | string | null;
  taxa_percent: number | string | null;
  valor_taxa: number | string | null;
  valor_parceiro: number | string | null;
  pagamento_status: string;
  pagamento_ref: string | null;
  documento_parceiro_path: string | null;
  entregue_em: string | null;
  concluido_em: string | null;
  motivo_recusa: string | null;
  ref_codigo: string | null;
  origem: string;
  criado_em: string;
  atualizado_em: string;
  parceiros: { user_id: string; nome_publico: string; slug: string } | null;
}

const COLUNAS =
  "id, codigo, parceiro_id, cliente_id, servico_id, property_id, categoria, descricao, status, horarios_propostos, horario_confirmado, " +
  "valor_combinado, taxa_percent, valor_taxa, valor_parceiro, pagamento_status, pagamento_ref, documento_parceiro_path, entregue_em, " +
  "concluido_em, motivo_recusa, ref_codigo, origem, criado_em, atualizado_em, parceiros(user_id, nome_publico, slug)";

/** Pedido + papel de quem está logado. Quem não é parte recebe "não encontrado" (nunca vê que o pedido existe). */
async function carregar(pedidoId: string): Promise<{ admin: Admin; userId: string; p: LinhaPedido; papel: PapelNoPedido } | { erro: string }> {
  if (!UUID.test(pedidoId)) return { erro: "Pedido não encontrado." };
  const s = await sessao();
  if ("erro" in s) return s;
  const { data } = await s.admin.from("parceiro_pedidos").select(COLUNAS).eq("id", pedidoId).maybeSingle();
  const p = data as unknown as LinhaPedido | null;
  if (!p || !p.parceiros) return { erro: "Pedido não encontrado." };
  const papel: PapelNoPedido | null = p.cliente_id === s.userId ? "cliente" : p.parceiros.user_id === s.userId ? "parceiro" : null;
  if (!papel) return { erro: "Pedido não encontrado." };
  return { admin: s.admin, userId: s.userId, p, papel };
}

async function evento(admin: Admin, pedidoId: string, autorId: string | null, tipo: string, dados: Record<string, unknown> = {}) {
  await admin.from("parceiro_pedido_eventos").insert({ pedido_id: pedidoId, autor_id: autorId, tipo, dados });
}

/** Mensagem na conversa do pedido (separada das conversas de imóvel). O filtro de contato vale aqui também. */
async function mensagem(admin: Admin, p: Pick<LinhaPedido, "id" | "cliente_id" | "parceiros">, de: string, texto: string): Promise<boolean> {
  const parceiroUser = p.parceiros!.user_id;
  const para = de === p.cliente_id ? parceiroUser : p.cliente_id;
  const { error } = await admin.from("messages").insert({
    conversation_id: conversationId(p.cliente_id, parceiroUser, CHAVE_CONVERSA_PEDIDO(p.id)),
    sender_id: de,
    receiver_id: para,
    property_id: null,
    parceiro_pedido_id: p.id,
    body: guardContactInfo(texto).text,
  });
  return !error;
}

/** Aviso por e-mail e push (best-effort: nunca derruba a ação). */
async function avisar(admin: Admin, destino: string, ev: NotificationEvent, pedidoId: string) {
  try {
    const { data } = await admin.from("profiles").select("email, full_name, notif_email").eq("id", destino).maybeSingle();
    const d = data as { email: string | null; full_name: string | null; notif_email: boolean | null } | null;
    await notify({ event: ev, email: d?.notif_email === false ? undefined : (d?.email ?? undefined), name: d?.full_name ?? undefined, userId: destino, pushUrl: rota(pedidoId) });
  } catch {
    /* aviso é complemento */
  }
}

async function contaTeste(admin: Admin, userId: string): Promise<boolean> {
  if (integracoesSimuladas()) return true;
  const { data } = await admin.from("profiles").select("is_teste").eq("id", userId).maybeSingle();
  return (data as { is_teste?: boolean } | null)?.is_teste === true;
}

async function agendaDoParceiro(admin: Admin, parceiroId: string): Promise<{ janelas: JanelaAgenda[]; bloqueios: BloqueioAgenda[] }> {
  const { data } = await admin.from("parceiro_agenda").select("tipo, dia_semana, inicio, fim, data_inicio, data_fim").eq("parceiro_id", parceiroId);
  const linhas = (data ?? []) as { tipo: string; dia_semana: number | null; inicio: string | null; fim: string | null; data_inicio: string | null; data_fim: string | null }[];
  return {
    janelas: linhas
      .filter((l) => l.tipo === "janela" && l.dia_semana != null && l.inicio && l.fim)
      .map((l) => ({ dia: l.dia_semana!, inicio: l.inicio!.slice(0, 5), fim: l.fim!.slice(0, 5) })),
    // Bloqueio de dias inteiros, no calendário de Brasília (UTC−3): do início do 1º dia ao fim do último.
    bloqueios: linhas
      .filter((l) => l.tipo === "bloqueio" && l.data_inicio && l.data_fim)
      .map((l) => ({ inicio: `${l.data_inicio}T03:00:00Z`, fim: new Date(Date.parse(`${l.data_fim}T03:00:00Z`) + 86_400_000).toISOString() })),
  };
}

/** O imóvel do pedido é da pessoa (dona) ou da estadia dela (contrato como morador). */
async function imovelDaPessoa(admin: Admin, propertyId: string, userId: string): Promise<boolean> {
  const { data: dono } = await admin.from("properties").select("id").eq("id", propertyId).eq("owner_id", userId).maybeSingle();
  if (dono) return true;
  const { data: morador } = await admin.from("contratos").select("id").eq("property_id", propertyId).eq("tenant_id", userId).neq("status", "cancelado").limit(1).maybeSingle();
  return !!morador;
}

// ── 1. Pedido de orçamento ────────────────────────────────────────────────────────────────────────────────────

export interface EntradaPedido {
  parceiroId: string;
  servicoId?: string | null;
  categoria: string;
  descricao: string;
  propertyId?: string | null;
  horarios: string[];
  doCadastroDoImovel?: boolean;
}

export async function solicitarOrcamento(e: EntradaPedido): Promise<Res<{ id: string; codigo: string }>> {
  const s = await sessao();
  if ("erro" in s) return { ok: false, erro: s.erro };
  const { admin, userId } = s;
  if (!UUID.test(e.parceiroId) || !categoriaValida(e.categoria)) return { ok: false, erro: "Escolha o serviço." };
  const { data: parc } = await admin.from("parceiros").select("id, user_id, status, categorias").eq("id", e.parceiroId).maybeSingle();
  const parceiro = parc as { id: string; user_id: string; status: string; categorias: string[] | null } | null;
  if (!parceiro || parceiro.status !== "publicado") return { ok: false, erro: "Este parceiro não está recebendo pedidos agora." };
  if (parceiro.user_id === userId) return { ok: false, erro: "Você não pode pedir orçamento para a sua própria página." };
  if (!(parceiro.categorias ?? []).includes(e.categoria)) return { ok: false, erro: "Este parceiro não atende essa categoria." };
  if (e.servicoId) {
    if (!UUID.test(e.servicoId)) return { ok: false, erro: "Escolha o serviço." };
    const { data: sv } = await admin.from("parceiro_servicos").select("id").eq("id", e.servicoId).eq("parceiro_id", parceiro.id).eq("ativo", true).maybeSingle();
    if (!sv) return { ok: false, erro: "Escolha um serviço da lista do parceiro." };
  }
  if (e.propertyId) {
    if (!UUID.test(e.propertyId) || !(await imovelDaPessoa(admin, e.propertyId, userId))) return { ok: false, erro: "Escolha um imóvel seu ou da sua estadia." };
  }
  const agenda = await agendaDoParceiro(admin, parceiro.id);
  const v = validarPedido(e, agenda, new Date());
  if (!v.ok) return { ok: false, erro: v.erro };

  // Teto: até 3 orçamentos abertos por categoria (compara sem disparar para todos).
  const { count } = await admin
    .from("parceiro_pedidos")
    .select("id", { count: "exact", head: true })
    .eq("cliente_id", userId)
    .eq("categoria", e.categoria)
    .in("status", STATUS_ABERTOS as string[]);
  if (tetoAtingido(count ?? 0)) return { ok: false, erro: textoTeto(rotuloCategoria(e.categoria).toLowerCase()) };

  const jar = await cookies();
  const ref = await atribuicaoDoPedidoParceiro(admin, { parceiroId: parceiro.id, clienteId: userId, cookieValor: jar.get(REF_COOKIE_PARCEIRO)?.value }).catch(() => null);

  let criado: { id: string; codigo: string } | null = null;
  for (let tentativa = 0; tentativa < 3 && !criado; tentativa++) {
    const { data, error } = await admin
      .from("parceiro_pedidos")
      .insert({
        codigo: novoCodigo(),
        parceiro_id: parceiro.id,
        cliente_id: userId,
        servico_id: e.servicoId ?? null,
        property_id: e.propertyId ?? null,
        categoria: e.categoria,
        descricao: v.descricao,
        horarios_propostos: v.horarios,
        origem: "manual",
        ...(ref ?? {}),
      })
      .select("id, codigo")
      .single();
    if (!error && data) criado = data as { id: string; codigo: string };
    else if (error?.code !== "23505") return { ok: false, erro: "Não foi possível enviar o pedido agora. Tente de novo." };
  }
  if (!criado) return { ok: false, erro: "Não foi possível enviar o pedido agora. Tente de novo." };

  await evento(admin, criado.id, userId, "solicitado", { horarios: v.horarios.length, ref: !!ref });
  const p = { id: criado.id, cliente_id: userId, parceiros: { user_id: parceiro.user_id, nome_publico: "", slug: "" } };
  await mensagem(admin, p, userId, MENSAGENS_AUTOMATICAS.boas_vindas);
  await mensagem(admin, p, userId, v.descricao);
  await avisar(admin, parceiro.user_id, "parceiro_pedido_novo", criado.id);
  revalidatePath("/dashboard/servicos");
  return { ok: true, valor: criado };
}

// ── 2. Ações sobre o pedido (estado conferido pela regra pura) ───────────────────────────────────────────────

async function mudar(
  pedidoId: string,
  acao: AcaoPedido,
  aplicar: (c: { admin: Admin; userId: string; p: LinhaPedido }) => Promise<Res<Record<string, unknown>>>,
  depois?: (c: { admin: Admin; userId: string; p: LinhaPedido }) => Promise<void>,
): Promise<Res> {
  const c = await carregar(pedidoId);
  if ("erro" in c) return { ok: false, erro: c.erro };
  if (!podeFazer(acao, c.p.status, c.papel)) return { ok: false, erro: "Esta ação não está disponível agora. Atualize a página." };
  const r = await aplicar(c);
  if (!r.ok) return r;
  // Grava só se o estado ainda é o que foi conferido (dois cliques ao mesmo tempo não passam os dois).
  const { data, error } = await c.admin
    .from("parceiro_pedidos")
    .update({ ...r.valor, atualizado_em: new Date().toISOString() })
    .eq("id", c.p.id)
    .eq("status", c.p.status)
    .select("id");
  if (error || !data?.length) return { ok: false, erro: "O pedido mudou enquanto você decidia. Atualize a página." };
  await evento(c.admin, c.p.id, c.userId, acao, r.valor);
  if (depois) await depois(c);
  revalidatePath(rota(c.p.id));
  revalidatePath("/dashboard/servicos");
  revalidatePath("/dashboard/parceiro");
  return { ok: true, valor: null };
}

export async function enviarOrcamento(pedidoId: string, valor: unknown): Promise<Res> {
  const v = validarOrcamento(valor);
  if (!v.ok) return v;
  return mudar(
    pedidoId,
    "orcar",
    async () => ({ ok: true, valor: { status: "orcado", valor_combinado: v.valor } }),
    async ({ admin, userId, p }) => {
      await mensagem(admin, p, userId, MENSAGENS_AUTOMATICAS.orcamento(v.valor));
      await avisar(admin, p.cliente_id, "parceiro_orcamento_recebido", p.id);
    },
  );
}

export async function recusarPedido(pedidoId: string, motivo: string): Promise<Res> {
  const m = (motivo ?? "").trim();
  if (m.length < 3 || m.length > MOTIVO_RECUSA_MAX) return { ok: false, erro: `Diga o motivo em poucas palavras (até ${MOTIVO_RECUSA_MAX} caracteres).` };
  return mudar(
    pedidoId,
    "recusar_pedido",
    async () => ({ ok: true, valor: { status: "recusado", motivo_recusa: guardContactInfo(m).text } }),
    async ({ admin, userId, p }) => {
      await mensagem(admin, p, userId, `Pedido recusado pelo parceiro: ${m}`);
    },
  );
}

/** Aceite: taxa, valor da taxa e o que o parceiro recebe CONGELAM aqui. */
export async function aceitarOrcamento(pedidoId: string): Promise<Res> {
  return mudar(
    pedidoId,
    "aceitar_orcamento",
    async ({ p }) => {
      const valor = Number(p.valor_combinado);
      if (!Number.isFinite(valor) || valor <= 0) return { ok: false, erro: "O orçamento ainda não tem valor." };
      return { ok: true, valor: { status: "aceito", ...congelarValores(valor) } };
    },
    async ({ admin, userId, p }) => {
      await mensagem(admin, p, userId, "Orçamento aceito. Agora é só confirmar o horário.");
      await avisar(admin, p.parceiros!.user_id, "parceiro_orcamento_aceito", p.id);
    },
  );
}

export async function recusarOrcamento(pedidoId: string): Promise<Res> {
  return mudar(pedidoId, "recusar_orcamento", async () => ({ ok: true, valor: { status: "cancelado" } }), async ({ admin, userId, p }) => {
    await mensagem(admin, p, userId, "Orçamento recusado pelo cliente.");
  });
}

export async function cancelarPedido(pedidoId: string): Promise<Res> {
  return mudar(pedidoId, "cancelar", async () => ({ ok: true, valor: { status: "cancelado" } }), async ({ admin, userId, p }) => {
    await mensagem(admin, p, userId, "Pedido cancelado pelo cliente.");
  });
}

/**
 * Horário: o parceiro confirma um dos propostos, ou propõe outro (dentro da agenda) que o cliente confirma.
 * `proporOutro` grava a proposta do parceiro em horarios_propostos sem mudar o estado.
 */
export async function confirmarHorario(pedidoId: string, horario: string): Promise<Res> {
  const c = await carregar(pedidoId);
  if ("erro" in c) return { ok: false, erro: c.erro };
  const acao: AcaoPedido = c.papel === "parceiro" ? "confirmar_horario" : "confirmar_horario_proposto";
  const propostos = (c.p.horarios_propostos ?? []).map((h) => new Date(h).toISOString());
  const iso = new Date(horario).toISOString();
  if (!propostos.includes(iso)) return { ok: false, erro: "Escolha um dos horários propostos." };
  if (Date.parse(iso) <= Date.now()) return { ok: false, erro: "Esse horário já passou. Combine outro." };
  // O cliente só confirma o horário que o PARCEIRO propôs (o último evento de proposta é dele).
  if (c.papel === "cliente") {
    const { data } = await c.admin.from("parceiro_pedido_eventos").select("dados").eq("pedido_id", c.p.id).eq("tipo", "propor_horario").order("criado_em", { ascending: false }).limit(1).maybeSingle();
    if ((data as { dados?: { horario?: string } } | null)?.dados?.horario !== iso) return { ok: false, erro: "Aguarde o parceiro confirmar um horário." };
  }
  return mudar(
    pedidoId,
    acao,
    async () => ({ ok: true, valor: { status: "agendado", horario_confirmado: iso } }),
    async ({ admin, userId, p }) => {
      const quando = dataHoraBRT(iso);
      await mensagem(admin, p, userId, MENSAGENS_AUTOMATICAS.horario(quando));
      await avisar(admin, p.cliente_id, "parceiro_horario_confirmado", p.id);
      await avisar(admin, p.parceiros!.user_id, "parceiro_horario_confirmado", p.id);
    },
  );
}

export async function proporOutroHorario(pedidoId: string, horario: string): Promise<Res> {
  const c = await carregar(pedidoId);
  if ("erro" in c) return { ok: false, erro: c.erro };
  if (c.papel !== "parceiro" || c.p.status !== "aceito") return { ok: false, erro: "Esta ação não está disponível agora. Atualize a página." };
  const agenda = await agendaDoParceiro(c.admin, c.p.parceiro_id);
  if (!horarioNaAgenda(horario, agenda.janelas, agenda.bloqueios, new Date())) return { ok: false, erro: "Esse horário está fora da sua agenda." };
  const iso = new Date(horario).toISOString();
  const lista = [...new Set([...(c.p.horarios_propostos ?? []).map((h) => new Date(h).toISOString()), iso])].slice(-3);
  const { error } = await c.admin.from("parceiro_pedidos").update({ horarios_propostos: lista, atualizado_em: new Date().toISOString() }).eq("id", c.p.id).eq("status", "aceito");
  if (error) return { ok: false, erro: "Não foi possível salvar o horário." };
  await evento(c.admin, c.p.id, c.userId, "propor_horario", { horario: iso });
  await mensagem(c.admin, c.p, c.userId, `O parceiro propôs outro horário: ${dataHoraBRT(iso)}. Confirme pelo pedido.`);
  await avisar(c.admin, c.p.cliente_id, "parceiro_horario_confirmado", c.p.id);
  revalidatePath(rota(c.p.id));
  return { ok: true, valor: null };
}

// ── 3. Pagamento: só simulado (registro, sem dinheiro) ───────────────────────────────────────────────────────

export async function simularPagamento(pedidoId: string): Promise<Res> {
  const c = await carregar(pedidoId);
  if ("erro" in c) return { ok: false, erro: c.erro };
  if (c.papel !== "cliente") return { ok: false, erro: "Esta ação não está disponível." };
  const teste = await contaTeste(c.admin, c.userId);
  if (!podeSimularPagamento({ chaveLigada: PAGAMENTO_PARCEIROS_ATIVO, contaTeste: teste, status: c.p.status, pagamentoStatus: c.p.pagamento_status }))
    return { ok: false, erro: "Esta ação não está disponível." };
  const valores = congelarValores(Number(c.p.valor_combinado));
  const r = await provedorSimulado.pagar({ pedidoId: c.p.id, valores });
  const { error } = await c.admin
    .from("parceiro_pedidos")
    .update({ pagamento_status: r.status, pagamento_ref: r.ref, atualizado_em: new Date().toISOString() })
    .eq("id", c.p.id)
    .eq("pagamento_status", "indisponivel");
  if (error) return { ok: false, erro: "Não foi possível registrar." };
  await evento(c.admin, c.p.id, c.userId, "pagamento_simulado", { ref: r.ref, valor_parceiro: c.p.valor_parceiro, valor_taxa: c.p.valor_taxa });
  revalidatePath(rota(c.p.id));
  return { ok: true, valor: null };
}

// ── 4. Execução, entrega, documento e conclusão ──────────────────────────────────────────────────────────────

export async function iniciarExecucao(pedidoId: string): Promise<Res> {
  return mudar(pedidoId, "iniciar", async () => ({ ok: true, valor: { status: "em_execucao" } }));
}

function nomeSeguro(nome: string): string {
  const base = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return (base || "arquivo").slice(-80);
}

/** O parceiro sobe os entregáveis (bucket privado; o cliente baixa por URL assinada de 10 min). */
export async function enviarEntrega(form: FormData): Promise<Res> {
  const pedidoId = String(form.get("pedidoId") ?? "");
  const c = await carregar(pedidoId);
  if ("erro" in c) return { ok: false, erro: c.erro };
  if (c.papel !== "parceiro" || !["em_execucao", "entregue"].includes(c.p.status)) return { ok: false, erro: "Comece o serviço antes de enviar a entrega." };
  const arquivos = form.getAll("arquivos").filter((f): f is File => f instanceof File && f.size > 0);
  if (arquivos.length === 0) return { ok: false, erro: "Escolha os arquivos." };
  if (arquivos.length > 40) return { ok: false, erro: "Envie até 40 arquivos por vez." };
  for (const f of arquivos) {
    if (!TIPOS_ENTREGA.has(f.type) || f.size > ARQUIVO_MAX) return { ok: false, erro: "Use JPG, PNG, WebP, PDF, ZIP ou MP4 de até 25 MB." };
  }
  for (const f of arquivos) {
    const path = `${c.p.id}/${Date.now()}-${randomBytes(3).toString("hex")}-${nomeSeguro(f.name)}`;
    const up = await c.admin.storage.from(BUCKET_ENTREGAS).upload(path, Buffer.from(await f.arrayBuffer()), { contentType: f.type, upsert: false });
    if (up.error) return { ok: false, erro: "Não foi possível enviar um dos arquivos. Tente de novo." };
    await c.admin.from("parceiro_entregas").insert({ pedido_id: c.p.id, path, legenda: f.name.slice(0, 120) });
  }
  await evento(c.admin, c.p.id, c.userId, "entrega_arquivos", { quantidade: arquivos.length });
  revalidatePath(rota(c.p.id));
  return { ok: true, valor: null };
}

/** Nota ou recibo do PARCEIRO (o documento do serviço é dele; a Viva não emite nada aqui). */
export async function enviarDocumentoParceiro(form: FormData): Promise<Res> {
  const pedidoId = String(form.get("pedidoId") ?? "");
  const c = await carregar(pedidoId);
  if ("erro" in c) return { ok: false, erro: c.erro };
  if (c.papel !== "parceiro" || !["aceito", "agendado", "em_execucao", "entregue", "concluido"].includes(c.p.status)) return { ok: false, erro: "Esta ação não está disponível." };
  const f = form.get("documento");
  if (!(f instanceof File) || f.size === 0) return { ok: false, erro: "Escolha o arquivo." };
  if (!TIPOS_DOCUMENTO.has(f.type) || f.size > 10 * 1024 * 1024) return { ok: false, erro: "Use PDF ou imagem de até 10 MB." };
  const path = `${c.p.id}/documento-${Date.now()}-${nomeSeguro(f.name)}`;
  const up = await c.admin.storage.from(BUCKET_ENTREGAS).upload(path, Buffer.from(await f.arrayBuffer()), { contentType: f.type, upsert: false });
  if (up.error) return { ok: false, erro: "Não foi possível enviar o documento." };
  await c.admin.from("parceiro_pedidos").update({ documento_parceiro_path: path, atualizado_em: new Date().toISOString() }).eq("id", c.p.id);
  await evento(c.admin, c.p.id, c.userId, "documento_parceiro", {});
  revalidatePath(rota(c.p.id));
  return { ok: true, valor: null };
}

export async function marcarEntregue(pedidoId: string): Promise<Res> {
  return mudar(
    pedidoId,
    "entregar",
    async () => ({ ok: true, valor: { status: "entregue", entregue_em: new Date().toISOString() } }),
    async ({ admin, userId, p }) => {
      await mensagem(admin, p, userId, MENSAGENS_AUTOMATICAS.entrega);
      await avisar(admin, p.cliente_id, "parceiro_entrega_feita", p.id);
    },
  );
}

export async function concluirPedido(pedidoId: string): Promise<Res> {
  return mudar(
    pedidoId,
    "concluir",
    async () => ({ ok: true, valor: { status: "concluido", concluido_em: new Date().toISOString() } }),
    async ({ admin, userId, p }) => {
      await mensagem(admin, p, userId, MENSAGENS_AUTOMATICAS.avaliacao);
      await avisar(admin, p.cliente_id, "parceiro_avaliacao", p.id);
      await avisar(admin, p.parceiros!.user_id, "parceiro_avaliacao", p.id);
    },
  );
}

/** URL assinada (10 min) de uma entrega ou do documento do parceiro — só para as partes. */
export async function linkArquivoDoPedido(pedidoId: string, alvo: { entregaId: string } | { documento: true }): Promise<Res<string>> {
  const c = await carregar(pedidoId);
  if ("erro" in c) return { ok: false, erro: c.erro };
  let path: string | null = null;
  if ("entregaId" in alvo) {
    if (!UUID.test(alvo.entregaId)) return { ok: false, erro: "Arquivo não encontrado." };
    const { data } = await c.admin.from("parceiro_entregas").select("path").eq("id", alvo.entregaId).eq("pedido_id", c.p.id).maybeSingle();
    path = (data as { path?: string } | null)?.path ?? null;
  } else path = c.p.documento_parceiro_path;
  if (!path) return { ok: false, erro: "Arquivo não encontrado." };
  const { data, error } = await c.admin.storage.from(BUCKET_ENTREGAS).createSignedUrl(path, URL_ASSINADA_SEG, { download: true });
  if (error || !data?.signedUrl) return { ok: false, erro: "Não foi possível abrir o arquivo agora." };
  return { ok: true, valor: data.signedUrl };
}

/**
 * Fotógrafo com imóvel vinculado: o cliente (dono do imóvel) copia as fotos entregues para as fotos do anúncio,
 * DEPOIS das que já existem (nada é apagado). Só imagens; o bucket do anúncio é o de sempre (property-photos).
 */
export async function usarFotosNoAnuncio(pedidoId: string): Promise<Res<{ copiadas: number }>> {
  const c = await carregar(pedidoId);
  if ("erro" in c) return { ok: false, erro: c.erro };
  if (c.papel !== "cliente" || c.p.categoria !== "fotografia" || !c.p.property_id || !["entregue", "concluido"].includes(c.p.status))
    return { ok: false, erro: "Esta ação não está disponível." };
  const { data: imovel } = await c.admin.from("properties").select("id").eq("id", c.p.property_id).eq("owner_id", c.userId).maybeSingle();
  if (!imovel) return { ok: false, erro: "Só o dono do imóvel usa as fotos no anúncio." };
  const { data: entregas } = await c.admin.from("parceiro_entregas").select("path").eq("pedido_id", c.p.id).order("criado_em");
  const imagens = ((entregas ?? []) as { path: string }[]).filter((e) => /\.(jpe?g|png|webp)$/i.test(e.path));
  if (imagens.length === 0) return { ok: false, erro: "A entrega não tem fotos." };
  const { data: atuais } = await c.admin.from("property_photos").select("url, sort_order").eq("property_id", c.p.property_id);
  const ja = new Set(((atuais ?? []) as { url: string }[]).map((f) => f.url));
  let ordem = Math.max(-1, ...((atuais ?? []) as { sort_order: number | null }[]).map((f) => f.sort_order ?? 0)) + 1;
  let copiadas = 0;
  for (const img of imagens) {
    const destino = `${c.userId}/${c.p.property_id}/parceiro-${c.p.codigo}-${img.path.split("/").pop()}`;
    const dl = await c.admin.storage.from(BUCKET_ENTREGAS).download(img.path);
    if (dl.error || !dl.data) continue;
    const up = await c.admin.storage.from("property-photos").upload(destino, dl.data, { upsert: true, contentType: dl.data.type || "image/jpeg" });
    if (up.error) continue;
    const url = c.admin.storage.from("property-photos").getPublicUrl(destino).data.publicUrl;
    if (ja.has(url)) continue;
    const { error } = await c.admin.from("property_photos").insert({ property_id: c.p.property_id, url, sort_order: ordem++ });
    if (!error) copiadas++;
  }
  await evento(c.admin, c.p.id, c.userId, "fotos_no_anuncio", { copiadas });
  revalidatePath(rota(c.p.id));
  return { ok: true, valor: { copiadas } };
}

// ── 5. Avaliação (cega até as duas partes ou 14 dias) ────────────────────────────────────────────────────────

export async function avaliarPedido(pedidoId: string, nota: number, texto: string): Promise<Res> {
  const c = await carregar(pedidoId);
  if ("erro" in c) return { ok: false, erro: c.erro };
  if (c.p.status !== "concluido") return { ok: false, erro: "A avaliação abre quando o serviço é concluído." };
  if (!Number.isInteger(nota) || nota < 1 || nota > 5) return { ok: false, erro: "Escolha de 1 a 5 estrelas." };
  const t = (texto ?? "").trim();
  if (t.length > 500) return { ok: false, erro: "O texto pode ter até 500 caracteres." };
  const g = guardContactInfo(t);
  const { error } = await c.admin.from("parceiro_avaliacoes").insert({
    pedido_id: c.p.id,
    autor_id: c.userId,
    papel_autor: c.papel,
    nota,
    texto: g.text || null,
    status: g.masked ? "em_moderacao" : "enviada",
  });
  if (error) return { ok: false, erro: error.code === "23505" ? "Você já avaliou este serviço." : "Não foi possível enviar a avaliação." };
  await c.admin.rpc("publicar_avaliacoes_parceiro", { p_pedido: c.p.id });
  await evento(c.admin, c.p.id, c.userId, "avaliacao", { nota });
  revalidatePath(rota(c.p.id));
  return { ok: true, valor: null };
}

// ── 6. Conversa do pedido ─────────────────────────────────────────────────────────────────────────────────────

export async function enviarMensagemDoPedido(pedidoId: string, texto: string): Promise<Res<{ mascarado: boolean }>> {
  const c = await carregar(pedidoId);
  if ("erro" in c) return { ok: false, erro: c.erro };
  const t = (texto ?? "").trim();
  if (!t) return { ok: false, erro: "Escreva a mensagem." };
  if (t.length > 2000) return { ok: false, erro: "A mensagem pode ter até 2000 caracteres." };
  if (["recusado", "cancelado"].includes(c.p.status)) return { ok: false, erro: "Este pedido foi encerrado." };
  const ok = await mensagem(c.admin, c.p, c.userId, t);
  if (!ok) return { ok: false, erro: "Não foi possível enviar agora. Tente de novo." };
  revalidatePath(rota(c.p.id));
  return { ok: true, valor: { mascarado: guardContactInfo(t).masked } };
}

// ── 7. Leitura: detalhe, meus pedidos, pedidos do parceiro ───────────────────────────────────────────────────

export interface DetalhePedido {
  id: string;
  codigo: string;
  papel: PapelNoPedido;
  status: string;
  categoria: string;
  descricao: string | null;
  parceiro: { nome: string; slug: string };
  cliente: { nome: string };
  imovel: { bairro: string | null; cidade: string | null; areaM2: number | null; quartos: number | null; endereco: string | null; titulo: string | null } | null;
  horariosPropostos: string[];
  horarioConfirmado: string | null;
  ultimoHorarioDoParceiro: string | null;
  valores: { combinado: number | null; taxa: number | null; parceiro: number | null; taxaPercent: number | null };
  pagamentoStatus: string;
  podeSimularPagamento: boolean;
  entregas: { id: string; legenda: string | null }[];
  temDocumento: boolean;
  motivoRecusa: string | null;
  mensagens: { id: string; minha: boolean; texto: string; em: string }[];
  minhaAvaliacao: { nota: number; status: string } | null;
  avaliacaoDoOutro: { nota: number; texto: string | null } | null;
  ehDonoDoImovel: boolean;
}

export async function detalheDoPedido(pedidoId: string): Promise<DetalhePedido | null> {
  const c = await carregar(pedidoId);
  if ("erro" in c) return null;
  const { admin, p, papel, userId } = c;
  const parceiroUser = p.parceiros!.user_id;
  const [cli, imo, ent, msgs, avs, propostaParceiro] = await Promise.all([
    admin.from("profiles").select("full_name").eq("id", p.cliente_id).maybeSingle(),
    p.property_id ? admin.from("properties").select("title, address, exact_address, city, area_m2, bedrooms, owner_id").eq("id", p.property_id).maybeSingle() : Promise.resolve({ data: null }),
    admin.from("parceiro_entregas").select("id, legenda").eq("pedido_id", p.id).order("criado_em"),
    admin
      .from("messages")
      .select("id, sender_id, body, created_at")
      .eq("conversation_id", conversationId(p.cliente_id, parceiroUser, CHAVE_CONVERSA_PEDIDO(p.id)))
      .eq("parceiro_pedido_id", p.id)
      .in("sender_id", [p.cliente_id, parceiroUser])
      .order("created_at")
      .limit(300),
    admin.from("parceiro_avaliacoes").select("autor_id, nota, texto, status").eq("pedido_id", p.id),
    admin.from("parceiro_pedido_eventos").select("dados").eq("pedido_id", p.id).eq("tipo", "propor_horario").order("criado_em", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const im = imo.data as { title: string | null; address: string | null; exact_address: string | null; city: string | null; area_m2: number | null; bedrooms: number | null; owner_id: string } | null;
  const nomeCliente = (cli.data as { full_name: string | null } | null)?.full_name ?? null;
  const imovelBase = im ? { bairro: im.address, cidade: im.city, areaM2: im.area_m2, quartos: im.bedrooms, endereco: im.exact_address } : null;
  // Privacidade: o parceiro só vê endereço e nome completo depois do aceite.
  const visao = papel === "parceiro" ? visaoDoParceiro(p.status, imovelBase, { nomeCompleto: nomeCliente }) : { nome: nomeCliente ?? "Você", imovel: imovelBase };
  const avaliacoes = (avs.data ?? []) as { autor_id: string; nota: number; texto: string | null; status: string }[];
  const minha = avaliacoes.find((a) => a.autor_id === userId) ?? null;
  const outra = avaliacoes.find((a) => a.autor_id !== userId && a.status === "publicada") ?? null;
  const n = (v: number | string | null) => (v == null ? null : Number(v));
  const teste = papel === "cliente" ? await contaTeste(admin, userId) : false;
  return {
    id: p.id,
    codigo: p.codigo,
    papel,
    status: p.status,
    categoria: p.categoria,
    descricao: p.descricao,
    parceiro: { nome: p.parceiros!.nome_publico, slug: p.parceiros!.slug },
    cliente: { nome: visao.nome },
    imovel: visao.imovel ? { ...visao.imovel, titulo: papel === "cliente" ? (im?.title ?? null) : null } : null,
    horariosPropostos: (p.horarios_propostos ?? []).map((h) => new Date(h).toISOString()),
    horarioConfirmado: p.horario_confirmado,
    ultimoHorarioDoParceiro: (propostaParceiro.data as { dados?: { horario?: string } } | null)?.dados?.horario ?? null,
    valores: { combinado: n(p.valor_combinado), taxa: n(p.valor_taxa), parceiro: n(p.valor_parceiro), taxaPercent: n(p.taxa_percent) },
    pagamentoStatus: p.pagamento_status,
    podeSimularPagamento: papel === "cliente" && podeSimularPagamento({ chaveLigada: PAGAMENTO_PARCEIROS_ATIVO, contaTeste: teste, status: p.status, pagamentoStatus: p.pagamento_status }),
    entregas: ((ent.data ?? []) as { id: string; legenda: string | null }[]).map((e) => ({ id: e.id, legenda: e.legenda })),
    temDocumento: !!p.documento_parceiro_path,
    motivoRecusa: p.motivo_recusa,
    mensagens: ((msgs.data ?? []) as { id: string; sender_id: string; body: string; created_at: string }[]).map((m) => ({ id: m.id, minha: m.sender_id === userId, texto: m.body, em: m.created_at })),
    minhaAvaliacao: minha ? { nota: minha.nota, status: minha.status } : null,
    avaliacaoDoOutro: outra ? { nota: outra.nota, texto: outra.texto } : null,
    ehDonoDoImovel: !!im && im.owner_id === userId,
  };
}

export interface ResumoPedido {
  id: string;
  codigo: string;
  status: string;
  categoria: string;
  outroLado: string;
  valor: number | null;
  horario: string | null;
  criadoEm: string;
}

function resumo(rows: LinhaPedido[], papel: PapelNoPedido, nomes: Map<string, string>): ResumoPedido[] {
  return rows.map((p) => ({
    id: p.id,
    codigo: p.codigo,
    status: p.status,
    categoria: p.categoria,
    outroLado: papel === "cliente" ? (p.parceiros?.nome_publico ?? "Parceiro") : (nomes.get(p.cliente_id) ?? "Cliente"),
    valor: p.valor_combinado == null ? null : Number(p.valor_combinado),
    horario: p.horario_confirmado,
    criadoEm: p.criado_em,
  }));
}

/** "Meus pedidos" de quem contrata (morador ou dono). */
export async function meusPedidosDeServico(): Promise<ResumoPedido[]> {
  const s = await sessao();
  if ("erro" in s) return [];
  const { data } = await s.admin.from("parceiro_pedidos").select(COLUNAS).eq("cliente_id", s.userId).order("criado_em", { ascending: false }).limit(100);
  return resumo((data ?? []) as unknown as LinhaPedido[], "cliente", new Map());
}

/** Pedidos do parceiro logado (novos primeiro). O nome do cliente é só o primeiro até o aceite. */
export async function pedidosDoMeuParceiro(): Promise<ResumoPedido[]> {
  const s = await sessao();
  if ("erro" in s) return [];
  const { data: parc } = await s.admin.from("parceiros").select("id").eq("user_id", s.userId).maybeSingle();
  if (!parc) return [];
  const { data } = await s.admin.from("parceiro_pedidos").select(COLUNAS).eq("parceiro_id", (parc as { id: string }).id).order("criado_em", { ascending: false }).limit(200);
  const rows = (data ?? []) as unknown as LinhaPedido[];
  const { data: perfis } = await s.admin.from("profiles").select("id, full_name").in("id", [...new Set(rows.map((r) => r.cliente_id))]);
  const completo = new Map(((perfis ?? []) as { id: string; full_name: string | null }[]).map((x) => [x.id, x.full_name]));
  const nomes = new Map(rows.map((r) => [r.cliente_id, visaoDoParceiro(r.status, null, { nomeCompleto: completo.get(r.cliente_id) ?? null }).nome]));
  const ordem = (st: string) => (st === "solicitado" ? 0 : st === "aceito" ? 1 : st === "orcado" ? 2 : 3);
  return resumo(rows, "parceiro", nomes).sort((a, b) => ordem(a.status) - ordem(b.status) || b.criadoEm.localeCompare(a.criadoEm));
}

/** Admin abre um pedido: grava no log de moderação. */
export async function registrarVistaDoAdmin(pedidoId: string): Promise<boolean> {
  if (!UUID.test(pedidoId)) return false;
  const supabase = await createClient();
  if (!supabase) return false;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await ehAdmin(supabase, user.id))) return false;
  await logModeracao(supabase, user.id, "ver_pedido_parceiro", "parceiro_pedido", pedidoId);
  return true;
}
