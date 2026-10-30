import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { conversationId } from "@/lib/messages/conversation-id";
import { guardContactInfo } from "@/lib/messages/contact-guard";
import { notify, type NotificationEvent } from "@/lib/notifications";
import { CHAVE_CONVERSA_PEDIDO, type BloqueioAgenda, type JanelaAgenda } from "./pedido";
import { blocoDados } from "@/lib/notifications/modelo-email";
import { escaparHtml } from "@/lib/escapar-html";
import { rotuloCategoria } from "./regras";
import { primeiroNome } from "@/lib/display-name";
import { EVENTOS_DO_PEDIDO, aberturaDoPedido, linhasDoPedido, type EventoPedido, type FatoDoPedido, type PedidoParaEmail } from "./email-pedido";

/*
  Peças do 31b usadas pelas ações (pedido-actions) e pelo servidor do 38 (cron e eventos da estadia, sem sessão).
  Fora do "use server": nada aqui vira ação chamável pelo navegador.
*/

type Admin = SupabaseClient;
const ALFABETO = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const rota = (id: string) => `/dashboard/servicos/pedidos/${id}`;

export function novoCodigo(): string {
  const b = randomBytes(8);
  return `VN-SV-${Array.from(b, (x) => ALFABETO[x % ALFABETO.length]).join("")}`;
}

export async function evento(admin: Admin, pedidoId: string, autorId: string | null, tipo: string, dados: Record<string, unknown> = {}) {
  await admin.from("parceiro_pedido_eventos").insert({ pedido_id: pedidoId, autor_id: autorId, tipo, dados });
}

/** Mensagem na conversa do pedido (separada das conversas de imóvel). O filtro de contato vale aqui também. */
export async function mensagem(admin: Admin, p: { id: string; cliente_id: string; parceiros: { user_id: string } | null }, de: string, texto: string): Promise<boolean> {
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

/**
 * E204/E267: o pedido como o e-mail precisa (serviço, imóvel, data/janela, valor e a outra parte vista por quem recebe:
 * o nome público do parceiro para o cliente, o primeiro nome do cliente para o parceiro). null se não achar.
 */
export async function pedidoParaEmail(admin: Admin, pedidoId: string, destino?: string): Promise<PedidoParaEmail | null> {
  const { data } = await admin
    .from("parceiro_pedidos")
    .select("codigo, categoria, cliente_id, horarios_propostos, horario_confirmado, janela_inicio, janela_fim, valor_combinado, valor_parceiro, parceiro_servicos(titulo), properties(title, address, city), parceiros(user_id, nome_publico)")
    .eq("id", pedidoId)
    .maybeSingle();
  if (!data) return null;
  const d = data as unknown as {
    codigo: string;
    categoria: string;
    cliente_id: string;
    horarios_propostos: string[] | null;
    horario_confirmado: string | null;
    janela_inicio: string | null;
    janela_fim: string | null;
    valor_combinado: number | string | null;
    valor_parceiro: number | string | null;
    parceiro_servicos: { titulo: string | null } | null;
    properties: { title: string | null; address: string | null; city: string | null } | null;
    parceiros: { user_id: string; nome_publico: string | null } | null;
  };
  let outraParte: string | null = null;
  if (destino && destino === d.cliente_id) outraParte = d.parceiros?.nome_publico ?? null;
  else if (destino) {
    const { data: cli } = await admin.from("profiles").select("full_name").eq("id", d.cliente_id).maybeSingle();
    outraParte = primeiroNome((cli as { full_name: string | null } | null)?.full_name) || null;
  }
  return {
    codigo: d.codigo,
    servico: d.parceiro_servicos?.titulo || rotuloCategoria(d.categoria),
    imovel: d.properties ? { titulo: d.properties.title, bairro: d.properties.address, cidade: d.properties.city } : null,
    janela: d.janela_inicio && d.janela_fim ? { inicio: d.janela_inicio, fim: d.janela_fim } : null,
    horarios: d.horarios_propostos,
    horarioConfirmado: d.horario_confirmado,
    valorCombinado: d.valor_combinado == null ? null : Number(d.valor_combinado),
    valorParceiro: d.valor_parceiro == null ? null : Number(d.valor_parceiro),
    outraParte,
  };
}

/** Aviso por e-mail e push (best-effort: nunca derruba a ação). */
export async function avisar(
  admin: Admin,
  destino: string,
  ev: NotificationEvent,
  pedidoId: string,
  opcoes: {
    semPush?: boolean;
    /** Frase própria (ex.: o motivo da recusa); o bloco do pedido (serviço, imóvel, data) vai junto. */
    texto?: string;
    /** Destino do botão no lugar do pedido. */
    url?: string;
    /** E267: o fato que o pedido não guarda (horário proposto, motivo e nova data do cancelamento). */
    fato?: FatoDoPedido;
  } = {},
) {
  try {
    const { data } = await admin.from("profiles").select("email, full_name, notif_email").eq("id", destino).maybeSingle();
    const d = data as { email: string | null; full_name: string | null; notif_email: boolean | null } | null;
    // E204/E267: todo e-mail do pedido diz o serviço, o imóvel, a data (e o valor, quando há) e o fato do evento.
    const ped = EVENTOS_DO_PEDIDO.has(ev) ? await pedidoParaEmail(admin, pedidoId, destino).catch(() => null) : null;
    const linhas = ped ? linhasDoPedido(ev as EventoPedido, ped, opcoes.fato) : null;
    await notify({
      event: ev,
      email: d?.notif_email === false ? undefined : (d?.email ?? undefined),
      name: d?.full_name ?? undefined,
      userId: destino,
      pushUrl: opcoes.url ?? rota(pedidoId),
      semPush: opcoes.semPush,
      ...(ped ? { body: (nome?: string) => aberturaDoPedido(ev as EventoPedido, ped, nome, opcoes.fato) } : {}),
      ...(opcoes.texto ? { body: (nome?: string) => `Olá${nome ? " " + nome : ""}, ${opcoes.texto}` } : {}),
      ...(linhas
        ? {
            detailsHtml: blocoDados(linhas.map((l) => ({ rotulo: escaparHtml(l.rotulo), valor: escaparHtml(l.valor) }))),
            detailsText: linhas.map((l) => `${l.rotulo}: ${l.valor}`).join("\n"),
          }
        : {}),
    });
  } catch {
    /* aviso é complemento */
  }
}

export async function agendaDoParceiro(admin: Admin, parceiroId: string): Promise<{ janelas: JanelaAgenda[]; bloqueios: BloqueioAgenda[] }> {
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
