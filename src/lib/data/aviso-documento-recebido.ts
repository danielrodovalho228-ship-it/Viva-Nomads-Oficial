import "server-only";
import { notify } from "@/lib/notifications";
import { adminsPorAviso } from "@/lib/notifications/push-admins";
import { createAdminClient } from "@/lib/supabase/admin";
import { codigoDoImovel } from "@/lib/imovel-pagina";
import { blocoDados } from "@/lib/notifications/modelo-email";
import { textoEmail, textoPlano } from "@/lib/notifications/texto-seguro";

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
        // Prompt 44 (item 3): documento na fila também vai por push ao admin com alertas operacionais.
        userId: a.id,
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

/**
 * E948: no mesmo momento em que a equipe recebe o `documento_recebido`, o PROPRIETÁRIO recebe o `documento_em_analise`
 * ("Recebemos o documento do seu imóvel", com TEXTO_PRAZO_DOCUMENTO). Com o imóvel conhecido, o bloco do e-mail nomeia o
 * imóvel (título · bairro · código), como nos outros e-mails do documento. Respeita o e-mail desligado no perfil.
 * Best-effort: nunca lança. Devolve se o aviso saiu.
 */
export async function avisarDonoDocumentoEmAnalise(donoId: string, propertyId?: string | null): Promise<boolean> {
  try {
    const admin = createAdminClient();
    if (!admin) return false;
    const { data } = await admin.from("profiles").select("email, full_name, notif_email").eq("id", donoId).maybeSingle();
    const p = data as { email: string | null; full_name: string | null; notif_email: boolean | null } | null;
    if (!p?.email || p.notif_email === false) return false;
    let detalhes: { detailsHtml: string; detailsText: string } | null = null;
    if (propertyId) {
      const { data: im } = await admin.from("properties").select("title, neighborhood").eq("id", propertyId).eq("owner_id", donoId).maybeSingle();
      const imovel = [(im as { title?: string | null } | null)?.title?.trim() || "Seu imóvel", (im as { neighborhood?: string | null } | null)?.neighborhood?.trim(), `código ${codigoDoImovel(propertyId)}`].filter(Boolean).join(" · ");
      detalhes = { detailsHtml: blocoDados([{ rotulo: "Imóvel", valor: textoEmail(imovel, 120) }]), detailsText: `Imóvel: ${textoPlano(imovel, 120)}` };
    }
    await notify({ event: "documento_em_analise", email: p.email, userId: donoId, name: p.full_name ?? undefined, ...(detalhes ?? {}) });
    return true;
  } catch {
    return false;
  }
}
