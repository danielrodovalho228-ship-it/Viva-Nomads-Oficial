"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarAberturaDaConversa } from "@/lib/notifications/push-servidor";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Prompt 44: a pessoa está com a conversa aberta. Nos 10 min seguintes, mensagem nova nesta conversa não vira push.
 * Só grava para quem é parte (tem mensagem enviada ou recebida na conversa). Best-effort: nunca falha a tela.
 */
export async function marcarConversaAberta(conversationId: string): Promise<void> {
  if (!UUID_RE.test(String(conversationId))) return;
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { count } = await admin
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
  if (!count) return;
  await registrarAberturaDaConversa(user.id, conversationId, admin);
  // E445 (item 4): abrir a conversa marca como lidas as mensagens RECEBIDAS nela (só lido_em; a RLS da 0287 só deixa o
  // destinatário marcar). Best-effort: antes da 0287, falha em silêncio.
  await supabase.from("messages").update({ lido_em: new Date().toISOString() }).eq("conversation_id", conversationId).eq("receiver_id", user.id).is("lido_em", null);
}

/** E445 (item 4): não lidas por conversa e o total — alimenta o sino (E444) como prioridade "urgente". */
export async function mensagensNaoLidas(): Promise<{ total: number; porConversa: Record<string, number>; prioridade: "urgente" } | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.rpc("mensagens_nao_lidas");
  if (error) throw new Error("Não foi possível contar as mensagens não lidas agora.");
  const porConversa: Record<string, number> = {};
  for (const r of (data ?? []) as { conversation_id: string; nao_lidas: number }[]) porConversa[r.conversation_id] = Number(r.nao_lidas) || 0;
  return { total: Object.values(porConversa).reduce((a, b) => a + b, 0), porConversa, prioridade: "urgente" };
}
