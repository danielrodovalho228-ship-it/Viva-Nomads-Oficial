import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notify } from "@/lib/notifications";
import { conversationId as idConversa } from "@/lib/messages/conversation-id";
import { datasDaEstadia, decidirEnvio, reagendar, type Quando } from "./regras";

/*
  Prompt 55-E2 — mensagens programadas (SERVER-ONLY, service role). O cron envia; o aditivo reagenda; o encerramento
  cancela. Tudo best-effort: falha aqui nunca derruba o aditivo nem o encerramento.
*/

type Admin = SupabaseClient;

export interface LinhaProgramada {
  id: string;
  contrato_id: string;
  owner_id: string;
  quando: Quando;
  texto: string;
  enviar_em: string;
  enviada_em: string | null;
  cancelada_em: string | null;
  motivo_cancelamento: string | null;
}

type Contrato = {
  id: string;
  property_id: string;
  tenant_id: string;
  status: string;
  properties: { owner_id: string } | null;
  contrato_blocos: { inicio: string; fim: string; status: string }[] | null;
};

export async function contratoDaProgramada(admin: Admin, contratoId: string): Promise<Contrato | null> {
  const { data } = await admin
    .from("contratos")
    .select("id, property_id, tenant_id, status, properties(owner_id), contrato_blocos(inicio, fim, status)")
    .eq("id", contratoId)
    .maybeSingle();
  return (data as unknown as Contrato | null) ?? null;
}

const COLUNAS = "id, contrato_id, owner_id, quando, texto, enviar_em, enviada_em, cancelada_em, motivo_cancelamento";

/** Aditivo assinado: o que não saiu ganha o horário das datas novas. */
export async function reagendarProgramadas(admin: Admin, contratoId: string): Promise<number> {
  try {
    const c = await contratoDaProgramada(admin, contratoId);
    const datas = c ? datasDaEstadia(c.contrato_blocos ?? []) : null;
    if (!datas) return 0;
    const { data } = await admin.from("mensagens_programadas").select(COLUNAS).eq("contrato_id", contratoId).is("enviada_em", null).is("cancelada_em", null);
    const mudar = reagendar((data ?? []) as LinhaProgramada[], datas);
    for (const u of mudar) {
      await admin.from("mensagens_programadas").update({ enviar_em: u.enviar_em, atualizado_em: new Date().toISOString() }).eq("id", u.id).is("enviada_em", null);
    }
    return mudar.length;
  } catch (e) {
    console.error("[programadas] reagendar:", e instanceof Error ? e.message : e);
    return 0;
  }
}

/** Contrato encerrado (ou o dono cancelou): o que não saiu é cancelado com o motivo. */
export async function cancelarProgramadas(admin: Admin, contratoId: string, motivo: "contrato_encerrado" | "dono" = "contrato_encerrado"): Promise<number> {
  try {
    const { data } = await admin
      .from("mensagens_programadas")
      .update({ cancelada_em: new Date().toISOString(), motivo_cancelamento: motivo, atualizado_em: new Date().toISOString() })
      .eq("contrato_id", contratoId)
      .is("enviada_em", null)
      .is("cancelada_em", null)
      .select("id");
    return data?.length ?? 0;
  } catch (e) {
    console.error("[programadas] cancelar:", e instanceof Error ? e.message : e);
    return 0;
  }
}

/** Passo do cron: envia o que chegou na hora (fora do silêncio), cancela o que perdeu o sentido. */
export async function enviarProgramadas(admin: Admin, agora: Date, soContrato?: string): Promise<{ enviadas: number; canceladas: number; esperando: number }> {
  const out = { enviadas: 0, canceladas: 0, esperando: 0 };
  let q = admin.from("mensagens_programadas").select(COLUNAS).is("enviada_em", null).is("cancelada_em", null).lte("enviar_em", agora.toISOString());
  if (soContrato) q = q.eq("contrato_id", soContrato);
  const { data } = await q.order("enviar_em").limit(200);
  const contratos = new Map<string, Contrato | null>();
  for (const p of (data ?? []) as LinhaProgramada[]) {
    try {
      if (!contratos.has(p.contrato_id)) contratos.set(p.contrato_id, await contratoDaProgramada(admin, p.contrato_id));
      const c = contratos.get(p.contrato_id) ?? null;
      const d = decidirEnvio(p, c?.status === "ativo" && c.properties?.owner_id === p.owner_id, agora);
      if (d.acao === "cancelar") {
        await admin.from("mensagens_programadas").update({ cancelada_em: agora.toISOString(), motivo_cancelamento: d.motivo }).eq("id", p.id).is("enviada_em", null).is("cancelada_em", null);
        out.canceladas += 1;
      } else if (d.acao === "enviar" && c) {
        if (await enviarUma(admin, p, c, agora)) out.enviadas += 1;
      } else out.esperando += 1;
    } catch (e) {
      console.error("[programadas] envio:", e instanceof Error ? e.message : e);
    }
  }
  return out;
}

async function enviarUma(admin: Admin, p: LinhaProgramada, c: Contrato, agora: Date): Promise<boolean> {
  // Trava antes de gravar: dois tiques ao mesmo tempo nunca mandam a mesma mensagem duas vezes.
  const { data: travou } = await admin
    .from("mensagens_programadas")
    .update({ enviada_em: agora.toISOString() })
    .eq("id", p.id)
    .is("enviada_em", null)
    .is("cancelada_em", null)
    .select("id");
  if (!travou?.length) return false;
  const conversa = idConversa(p.owner_id, c.tenant_id, c.property_id);
  const { data: msg, error } = await admin
    .from("messages")
    .insert({ conversation_id: conversa, sender_id: p.owner_id, receiver_id: c.tenant_id, property_id: c.property_id, body: p.texto })
    .select("id")
    .single();
  if (error || !msg) {
    // Volta para a fila: o próximo tique tenta de novo (o atraso máximo segura a repetição infinita).
    await admin.from("mensagens_programadas").update({ enviada_em: null }).eq("id", p.id);
    console.error("[programadas] gravar:", error?.code, error?.message);
    return false;
  }
  await admin.from("mensagens_programadas").update({ mensagem_id: msg.id }).eq("id", p.id);
  try {
    const { data: dono } = await admin.from("profiles").select("full_name").eq("id", p.owner_id).maybeSingle();
    const nome = String(dono?.full_name ?? "").trim().split(/\s+/)[0] || "O proprietário";
    await notify({ event: "new_message", userId: c.tenant_id, pushUrl: "/dashboard/mensagens", conversationId: conversa, remetenteNome: nome });
  } catch {
    /* aviso é best-effort */
  }
  return true;
}
