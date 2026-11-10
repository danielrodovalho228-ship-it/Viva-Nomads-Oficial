"use server";

import { createClient } from "@/lib/supabase/server";
import { adiarAte, type PrazoAdiar } from "@/lib/mensagens-filtros";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ResultadoAdiar = { ok: true; adiadaEm?: string; adiadaAte?: string } | { ok: false; erro: string };

/** E721: adia a conversa só para quem pede (a RLS da 0336 garante: própria linha, conversa de que é parte). */
export async function adiarConversa(conversationId: string, prazo: PrazoAdiar): Promise<ResultadoAdiar> {
  if (!UUID_RE.test(String(conversationId))) return { ok: false, erro: "Conversa inválida." };
  const ate = adiarAte(prazo);
  if (!ate) return { ok: false, erro: "Escolha um prazo." };
  const supabase = await createClient();
  if (!supabase) return { ok: false, erro: "Não foi possível adiar agora." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Entre na sua conta para adiar." };
  const adiadaEm = new Date().toISOString();
  const { error } = await supabase
    .from("conversas_adiadas")
    .upsert({ user_id: user.id, conversation_id: conversationId, adiada_em: adiadaEm, ate }, { onConflict: "user_id,conversation_id" });
  if (error) return { ok: false, erro: "Não foi possível adiar agora. Tente de novo." };
  return { ok: true, adiadaEm, adiadaAte: ate };
}

/** E721: volta a conversa para a lista principal. */
export async function retomarConversa(conversationId: string): Promise<ResultadoAdiar> {
  if (!UUID_RE.test(String(conversationId))) return { ok: false, erro: "Conversa inválida." };
  const supabase = await createClient();
  if (!supabase) return { ok: false, erro: "Não foi possível retomar agora." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Entre na sua conta." };
  const { error } = await supabase.from("conversas_adiadas").delete().eq("user_id", user.id).eq("conversation_id", conversationId);
  if (error) return { ok: false, erro: "Não foi possível retomar agora. Tente de novo." };
  return { ok: true };
}
