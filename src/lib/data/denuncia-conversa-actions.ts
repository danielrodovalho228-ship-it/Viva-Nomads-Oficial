"use server";

import { createClient } from "@/lib/supabase/server";
import { abrirChamado } from "@/lib/data/atendimento-actions";
import { ASSUNTO_DENUNCIA, textoDenuncia, validarDenuncia } from "@/lib/atendimento/denuncia-mensagem";

/**
 * "Denunciar mensagem suspeita" (ordem 404cd213, item 3): abre um chamado de segurança (P1, fila antifraude)
 * sobre a conversa. Só quem participa da conversa denuncia; o servidor confere, a tela não decide.
 */
export async function denunciarConversa(input: {
  conversationId: string;
  nota?: string;
}): Promise<{ ok: true; numero: string } | { ok: false; error: string }> {
  const v = validarDenuncia(input);
  if (!v.ok) return v;
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Atendimento indisponível no momento. Tente de novo em instantes." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre na sua conta para denunciar." };

  // RLS já limita a leitura às mensagens da pessoa; o filtro explícito deixa a regra à vista.
  const { data: msg } = await supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", v.conversationId)
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .limit(1)
    .maybeSingle();
  if (!msg) return { ok: false, error: "Conversa não encontrada." };

  const r = await abrirChamado({
    categoria: "seguranca",
    mensagem: textoDenuncia(v.conversationId, v.nota),
    assunto: ASSUNTO_DENUNCIA,
    canal: "site",
  });
  return r.ok ? { ok: true, numero: r.numero } : { ok: false, error: r.error };
}
