import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notify } from "@/lib/notifications";
import { adminsPorAviso } from "@/lib/notifications/push-admins";
import { ASSUNTOS } from "@/lib/notifications/assuntos";
import { LIMITE_AVISO_ADMIN } from "./ofensas";

/*
  E445 (item 3) — a pessoa foi avisada e enviou mesmo assim: registro na fila de moderação do admin (quem, conversa,
  termo). No 3º registro em 30 dias, a equipe (admins com alertas operacionais) é avisada — uma vez, sem o texto da
  mensagem. Best-effort: a mensagem já foi gravada; falha aqui só fica no log.
*/
const DIAS_JANELA = 30;

export async function registrarOfensa(
  admin: SupabaseClient,
  p: { autorId: string; conversationId: string; messageId: string | null; termo: string },
  agora = new Date(),
): Promise<{ registros: number; equipeAvisada: boolean }> {
  const { error } = await admin.from("moderacao_ofensas").insert({
    autor_id: p.autorId,
    conversation_id: p.conversationId,
    message_id: p.messageId,
    termo: p.termo.slice(0, 80),
  });
  if (error) {
    console.error("[ofensas] não registrou:", error.code, error.message);
    return { registros: 0, equipeAvisada: false };
  }
  const desde = new Date(agora.getTime() - DIAS_JANELA * 86_400_000).toISOString();
  const { count } = await admin.from("moderacao_ofensas").select("id", { count: "exact", head: true }).eq("autor_id", p.autorId).gte("criado_em", desde);
  const registros = count ?? 0;
  if (registros !== LIMITE_AVISO_ADMIN) return { registros, equipeAvisada: false };
  const admins = await adminsPorAviso<{ email: string | null; notif_email: boolean | null }>("operacional", "email, notif_email").catch(() => []);
  for (const a of admins) {
    await notify({
      event: "chamado_equipe",
      interno: true,
      email: a.email && a.notif_email !== false ? a.email : undefined,
      userId: a.id,
      pushUrl: "/admin/moderacao/ofensas",
      subject: ASSUNTOS.ofensasNoChat,
      body: () => `A mesma pessoa enviou ${LIMITE_AVISO_ADMIN} mensagens com termo ofensivo depois do aviso. Veja a fila de moderação.`,
      detailsText: `Conta: ${p.autorId}\nÚltimo termo: ${p.termo}`,
    }).catch(() => null);
  }
  return { registros, equipeAvisada: true };
}
