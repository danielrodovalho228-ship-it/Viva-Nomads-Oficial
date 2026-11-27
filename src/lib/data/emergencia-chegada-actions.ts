"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications";
import { dentroDoLimite } from "@/lib/limites";
import { hojeEmBrasilia } from "@/lib/checkin";
import { conversationId as idConversa } from "@/lib/messages/conversation-id";
import { urlDaConversa } from "@/lib/notifications/url-conversa";
import {
  ESPERA_ENTRE_ACIONAMENTOS_MIN,
  MSG_EMERGENCIA_NA_CONVERSA,
  TEXTO_EMERGENCIA_ENVIADA,
  TEXTO_EMERGENCIA_ESPERE,
  TEXTO_EMERGENCIA_INDISPONIVEL,
  emergenciaDisponivel,
} from "@/lib/estadia/emergencia-chegada";

/**
 * E664 — "Falar com o proprietário agora": só o morador do contrato, só no dia da entrada (blocos atuais), contrato ativo
 * e assinado pelas duas partes. Registra uma mensagem na conversa e avisa o proprietário com urgência (push + sino +
 * e-mail). A Viva é a intermediária: nenhum contato é lido, mostrado nem enviado (regra do E444/E445).
 */
export async function acionarEmergenciaChegada(contratoId: string): Promise<{ ok: boolean; error?: string; mensagem?: string }> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Serviço indisponível." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre na sua conta para continuar." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Serviço indisponível." };

  const { data: c, error } = await admin
    .from("contratos")
    .select("id, property_id, tenant_id, status, assinado_proprietario_em, assinado_inquilino_em, properties(owner_id, title), contrato_blocos(inicio, status)")
    .eq("id", contratoId)
    .eq("tenant_id", user.id)
    .maybeSingle();
  if (error) {
    console.error("[emergencia-chegada] ler contrato falhou:", error.message);
    return { ok: false, error: "Não foi possível enviar o aviso agora. Tente de novo." };
  }
  if (!c) return { ok: false, error: "Contrato não encontrado." };
  const prop = c.properties as unknown as { owner_id?: string; title?: string | null } | null;
  const blocos = ((c.contrato_blocos ?? []) as { inicio: string; status: string | null }[]).filter((b) => b.status !== "nao_aceito");
  const entrada = blocos.map((b) => b.inicio).sort()[0];
  const disponivel = emergenciaDisponivel({
    souMorador: c.tenant_id === user.id,
    status: c.status as string,
    assinadoPelasDuas: !!c.assinado_proprietario_em && !!c.assinado_inquilino_em,
    entrada,
    hoje: hojeEmBrasilia(new Date()),
  });
  if (!disponivel || !prop?.owner_id) return { ok: false, error: TEXTO_EMERGENCIA_INDISPONIVEL };

  if (!(await dentroDoLimite(`emergencia-chegada:${contratoId}`, 1, ESPERA_ENTRE_ACIONAMENTOS_MIN * 60))) {
    return { ok: false, error: TEXTO_EMERGENCIA_ESPERE };
  }

  const donoId = prop.owner_id;
  const propertyId = c.property_id as string;
  const conversa = idConversa(user.id, donoId, propertyId);
  const { error: erroMsg } = await admin.from("messages").insert({
    conversation_id: conversa,
    sender_id: user.id,
    receiver_id: donoId,
    property_id: propertyId,
    body: MSG_EMERGENCIA_NA_CONVERSA,
  });
  if (erroMsg) {
    console.error("[emergencia-chegada] gravar mensagem falhou:", erroMsg.message);
    return { ok: false, error: "Não foi possível enviar o aviso agora. Tente de novo." };
  }

  const { data: dono } = await admin.from("profiles").select("email, full_name, notif_email").eq("id", donoId).maybeSingle();
  await notify({
    event: "emergencia_chegada",
    email: dono?.email && dono.notif_email !== false ? (dono.email as string) : undefined,
    name: (dono?.full_name as string) ?? undefined,
    userId: donoId,
    pushUrl: urlDaConversa(conversa),
    imovelId: propertyId,
    refId: contratoId,
    // Urgente: o corpo diz o fato e o imóvel (régua do E267) e manda responder pela conversa — nunca um contato.
    body: (nome?: string) => `Olá${nome ? " " + nome : ""}, o morador chegou${prop.title ? ` a ${prop.title}` : " ao imóvel"} e pediu para falar com você agora. Responda pela conversa da plataforma: a Viva acompanha.`,
    detailsText: `${prop.title ? `Imóvel: ${prop.title}. ` : ""}Aviso urgente do dia da entrada.`,
  }).catch((e) => console.error("[emergencia-chegada] aviso falhou:", e instanceof Error ? e.message : e));

  return { ok: true, mensagem: TEXTO_EMERGENCIA_ENVIADA };
}
