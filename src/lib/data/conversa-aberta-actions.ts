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
}
