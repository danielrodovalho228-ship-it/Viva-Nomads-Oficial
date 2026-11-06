import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notify } from "@/lib/notifications";
import { adminsPorAviso } from "@/lib/notifications/push-admins";
import { LIMITE_BITS_FOTO_PARECIDA } from "./foto-repetida";

/*
  E640 (b) — depois que as fotos são ligadas ao imóvel, procura foto igual ou quase igual (hash perceptual) em anúncio de
  OUTRA conta real. Achou: grava o alerta (só o admin lê), marca o imóvel (a publicação fica travada até conferir a
  matrícula) e avisa o admin. Best-effort: NUNCA derruba o cadastro nem bloqueia o envio da foto.
*/
export async function registrarFotoRepetida(admin: SupabaseClient | null, propertyId: string): Promise<number> {
  if (!admin) return 0;
  try {
    const { data, error } = await admin.rpc("fotos_parecidas", { p_property: propertyId, p_max: LIMITE_BITS_FOTO_PARECIDA });
    if (error || !data || !(data as unknown[]).length) return 0;
    const achados = data as { caminho: string; outro_caminho: string; outro_owner: string; outro_property: string | null; distancia: number }[];
    const { data: imovel } = await admin.from("properties").select("owner_id, foto_repetida_em").eq("id", propertyId).maybeSingle();
    const ownerId = (imovel as { owner_id?: string } | null)?.owner_id;
    if (!ownerId) return 0;
    const novas = await admin.from("fotos_repetidas_alertas").upsert(
      achados.map((a) => ({
        property_id: propertyId,
        owner_id: ownerId,
        caminho: a.caminho,
        outro_owner_id: a.outro_owner,
        outro_property_id: a.outro_property,
        outro_caminho: a.outro_caminho,
        distancia: a.distancia,
      })),
      { onConflict: "property_id,caminho,outro_caminho", ignoreDuplicates: true },
    );
    if (novas.error) return 0;
    const jaMarcado = !!(imovel as { foto_repetida_em?: string | null } | null)?.foto_repetida_em;
    if (!jaMarcado) {
      await admin.from("properties").update({ foto_repetida_em: new Date().toISOString() }).eq("id", propertyId);
      const admins = await adminsPorAviso<{ email: string | null; full_name: string | null; notif_email: boolean | null }>("operacional", "email, full_name, notif_email");
      for (const a of admins) {
        if (a.email && a.notif_email !== false) await notify({ event: "documento_recebido", email: a.email, name: a.full_name ?? undefined, pushUrl: "/admin/documentos" });
      }
    }
    return achados.length;
  } catch {
    return 0;
  }
}
