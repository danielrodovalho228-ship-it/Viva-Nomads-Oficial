import "server-only";
import { notify } from "@/lib/notifications";
import { adminsPorAviso } from "@/lib/notifications/push-admins";

/**
 * Avisa a equipe (admins com "receber alertas operacionais" e e-mail ligado) de que há documento de imóvel para
 * conferir — evento `documento_recebido`, link para /admin/documentos. Nunca leva dado do documento; `detalhes`
 * é só texto de apoio (ex.: o dono e a data, na rede de segurança do cron). Best-effort: nunca lança.
 * Devolve quantos avisos saíram.
 */
export async function avisarAdminsDocumentoRecebido(detalhes?: string): Promise<number> {
  let n = 0;
  try {
    // Pelo servidor: a RLS de profiles só mostra o próprio perfil ao dono.
    const admins = await adminsPorAviso<{ email: string | null; full_name: string | null; notif_email: boolean | null }>(
      "operacional",
      "email, full_name, notif_email",
    );
    for (const a of admins) {
      if (!a.email || a.notif_email === false) continue;
      await notify({
        event: "documento_recebido",
        email: a.email,
        name: a.full_name ?? undefined,
        pushUrl: "/admin/documentos",
        ...(detalhes ? { detailsText: detalhes } : {}),
      });
      n++;
    }
  } catch {
    /* best-effort */
  }
  return n;
}
