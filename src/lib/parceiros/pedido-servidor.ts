import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { conversationId } from "@/lib/messages/conversation-id";
import { guardContactInfo } from "@/lib/messages/contact-guard";
import { notify, type NotificationEvent } from "@/lib/notifications";
import { CHAVE_CONVERSA_PEDIDO, type BloqueioAgenda, type JanelaAgenda } from "./pedido";

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

/** Aviso por e-mail e push (best-effort: nunca derruba a ação). */
export async function avisar(
  admin: Admin,
  destino: string,
  ev: NotificationEvent,
  pedidoId: string,
  opcoes: { semPush?: boolean; /** Frase própria (ex.: o motivo da recusa). */ texto?: string; /** Destino do botão no lugar do pedido. */ url?: string } = {},
) {
  try {
    const { data } = await admin.from("profiles").select("email, full_name, notif_email").eq("id", destino).maybeSingle();
    const d = data as { email: string | null; full_name: string | null; notif_email: boolean | null } | null;
    await notify({
      event: ev,
      email: d?.notif_email === false ? undefined : (d?.email ?? undefined),
      name: d?.full_name ?? undefined,
      userId: destino,
      pushUrl: opcoes.url ?? rota(pedidoId),
      semPush: opcoes.semPush,
      ...(opcoes.texto ? { body: (nome?: string) => `Olá${nome ? " " + nome : ""}, ${opcoes.texto}` } : {}),
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
