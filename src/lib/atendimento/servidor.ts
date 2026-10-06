import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications";
import { textoEmail } from "@/lib/notifications/texto-seguro";
import { SITE_URL } from "@/lib/site";
import { PRAZOS, type Prioridade } from "@/config/atendimento";

/**
 * Atendimento — utilidades SÓ DO SERVIDOR: token da nota de 1 a 5 (um clique,
 * sem login), avisos à equipe e e-mails ao usuário. Nunca importar no cliente.
 */

function segredo(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "viva-nomads";
}

/** Assinatura do link "dê uma nota" (chamado + nota). */
export function assinarNota(chamadoId: string, nota: number): string {
  return crypto.createHmac("sha256", segredo()).update(`nota:${chamadoId}:${nota}`).digest("hex").slice(0, 32);
}

export function notaValida(chamadoId: string, nota: number, assinatura: string): boolean {
  if (!/^[0-9a-f]{32}$/.test(assinatura)) return false;
  const esperado = Buffer.from(assinarNota(chamadoId, nota));
  return crypto.timingSafeEqual(esperado, Buffer.from(assinatura));
}

export function linkNota(chamadoId: string, nota: number): string {
  return `${SITE_URL}/api/atendimento/avaliar?c=${chamadoId}&n=${nota}&s=${assinarNota(chamadoId, nota)}`;
}

export interface ChamadoResumo {
  id: string;
  numero_publico: string;
  assunto: string;
  prioridade: Prioridade;
  usuario_id: string | null;
  visitante_email?: string | null;
  visitante_nome?: string | null;
}

/** Destinatário do chamado: perfil (com preferências) ou visitante. */
async function destinatario(c: ChamadoResumo) {
  const admin = createAdminClient();
  if (c.usuario_id && admin) {
    const { data } = await admin
      .from("profiles")
      .select("email, full_name, phone, notif_email, notif_whatsapp")
      .eq("id", c.usuario_id)
      .maybeSingle();
    if (!data) return null;
    return {
      email: data.notif_email === false ? undefined : ((data.email as string) ?? undefined),
      nome: (data.full_name as string) ?? undefined,
      phone: data.notif_whatsapp === true ? ((data.phone as string) ?? undefined) : undefined,
      userId: c.usuario_id,
    };
  }
  if (c.visitante_email) return { email: c.visitante_email, nome: c.visitante_nome ?? undefined, phone: undefined, userId: undefined };
  return null;
}

function linkChamado(c: ChamadoResumo): string {
  return c.usuario_id ? `${SITE_URL}/ajuda?chamado=${c.numero_publico}` : `${SITE_URL}/ajuda`;
}

/** E-mail ao usuário (abertura, resposta, resolução). WhatsApp: só o aviso curto, se ativado. */
export async function avisarUsuario(
  c: ChamadoResumo,
  evento: "chamado_aberto" | "chamado_respondido" | "chamado_resolvido",
  extraHtml = ""
): Promise<void> {
  const d = await destinatario(c);
  if (!d) return;
  const numero = textoEmail(c.numero_publico, 20);
  const assunto = { chamado_aberto: "Recebemos seu chamado", chamado_respondido: "Seu chamado foi respondido", chamado_resolvido: "Seu chamado foi resolvido" }[evento];
  let notas = "";
  if (evento === "chamado_resolvido") {
    notas = `<p style="margin:16px 0 6px;color:#0f1722;font-weight:600;">Como foi o atendimento? (1 = ruim, 5 = ótimo)</p><p style="margin:0;">${[1, 2, 3, 4, 5]
      .map(
        (n) =>
          `<a href="${linkNota(c.id, n)}" style="display:inline-block;margin:0 6px 6px 0;padding:8px 14px;border:1px solid #dce9e0;border-radius:10px;color:#1c6b3a;text-decoration:none;font-weight:600;">${n}</a>`
      )
      .join("")}</p>`;
  }
  await notify({
    event: evento,
    email: d.email,
    name: d.nome,
    phone: evento === "chamado_respondido" ? d.phone : undefined,
    userId: d.userId,
    pushUrl: "/ajuda",
    subject: `${assunto} — ${c.numero_publico}`,
    detailsText: `Chamado ${c.numero_publico}: ${linkChamado(c)}`,
    detailsHtml: `<p style="margin:12px 0 0;color:#334155;">Chamado <strong>${numero}</strong> · ${textoEmail(c.assunto, 140)}</p>${extraHtml}${notas}<p style="margin:16px 0 0;"><a href="${linkChamado(c)}" style="color:#1c6b3a;font-weight:600;">Abrir na Central de Ajuda</a></p>`,
  }).catch(() => null);
}

/** Avisa os admins (e-mail + push): P1/P2, aprovação, prazo em risco. */
export async function avisarEquipe(c: ChamadoResumo, motivo: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  const { data: admins } = await admin.from("profiles").select("id, email, full_name, notif_email").eq("role", "admin");
  const rotulo = PRAZOS[c.prioridade]?.rotulo ?? c.prioridade;
  for (const a of admins ?? []) {
    await notify({
      event: "chamado_equipe",
      email: a.notif_email === false ? undefined : ((a.email as string) ?? undefined),
      name: (a.full_name as string) ?? undefined,
      userId: a.id as string,
      pushUrl: `/admin/atendimento/${c.id}`,
      subject: `${c.prioridade.toUpperCase()} ${rotulo} — ${c.numero_publico}: ${motivo}`,
      detailsHtml: `<p style="margin:12px 0 0;color:#334155;"><strong>${textoEmail(c.numero_publico, 20)}</strong> · ${textoEmail(c.assunto, 140)}<br/>${textoEmail(motivo, 200)}</p><p style="margin:16px 0 0;"><a href="${SITE_URL}/admin/atendimento/${c.id}" style="color:#1c6b3a;font-weight:600;">Abrir no admin</a></p>`,
    }).catch(() => null);
  }
}
