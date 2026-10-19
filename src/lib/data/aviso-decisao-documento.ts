import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notify } from "@/lib/notifications";
import { notificacaoLigada } from "@/lib/notifications/preferencias";
import { prontidaoDoImovel } from "@/lib/anuncio/prontidao-servidor";
import { emailDecisaoDocumento, linhasDoAviso, type DecisaoParaAvisar, type OrigemDocumento } from "@/lib/documento/aviso-decisao";

/**
 * Avisa o dono (e-mail + push) das decisões da equipe sobre os documentos de UM imóvel — uma vez por imóvel
 * (rota rápida dos e-mails, item 3b). O banco decide se é hora (decisoes_documento_para_avisar, 0185): com outro
 * documento do mesmo imóvel ainda na fila, não devolve nada e o aviso espera; quando o último é decidido, devolve
 * e marca todas as decisões ainda não avisadas — só quem marcou envia. `forcar` = rede de segurança do cron.
 * Best-effort: nunca lança. Devolve quantas decisões foram avisadas.
 */
export async function avisarDecisoesDoImovel(admin: SupabaseClient, ownerId: string, propertyId: string | null, forcar = false): Promise<number> {
  try {
    const { data, error } = await admin.rpc("decisoes_documento_para_avisar", { p_owner: ownerId, p_property: propertyId, p_forcar: forcar });
    if (error || !Array.isArray(data) || data.length === 0) return 0;
    const decisoes: DecisaoParaAvisar[] = (data as { origem: string; documento_path: string | null; aprovado: boolean; motivo: string | null }[]).map((d) => ({
      origem: (d.origem === "matricula" ? "matricula" : "qualificacao") as OrigemDocumento,
      documentoPath: d.documento_path,
      aprovado: d.aprovado === true,
      motivo: d.motivo,
    }));
    const linhas = linhasDoAviso(decisoes);
    const [{ data: prof }, imovel, prontidao] = await Promise.all([
      admin.from("profiles").select("full_name, email, notif_email").eq("id", ownerId).maybeSingle(),
      propertyId ? admin.from("properties").select("title, neighborhood").eq("id", propertyId).maybeSingle() : Promise.resolve({ data: null }),
      propertyId ? prontidaoDoImovel(admin, ownerId, propertyId).catch(() => null) : Promise.resolve(null),
    ]);
    const im = (imovel as { data: { title?: string | null; neighborhood?: string | null } | null }).data;
    const email = emailDecisaoDocumento({
      propertyId,
      titulo: im?.title ?? null,
      bairro: im?.neighborhood ?? null,
      linhas,
      prontoParaPublicar: !!prontidao && prontidao.faltam.length === 0,
    });
    await notify({
      event: email.evento,
      email: prof?.email && notificacaoLigada(prof.notif_email as boolean | null) ? (prof.email as string) : undefined,
      name: (prof?.full_name as string | undefined) ?? undefined,
      userId: ownerId,
      pushUrl: email.cta.path,
      subject: email.assunto,
      body: email.intro,
      ctaLabel: email.cta.label,
      detailsHtml: email.detailsHtml,
      detailsText: email.detailsText,
    });
    return decisoes.length;
  } catch {
    return 0;
  }
}

/** Cron diário: decisões não avisadas há mais de `horas` (o admin deixou item na fila) — um aviso por imóvel. */
export async function avisarDecisoesAtrasadas(admin: SupabaseClient, horas = 2): Promise<number> {
  const { data, error } = await admin.rpc("decisoes_documento_atrasadas", { p_horas: horas });
  if (error || !Array.isArray(data)) return 0;
  let avisados = 0;
  for (const par of data as { owner_id: string; property_id: string | null }[]) {
    if ((await avisarDecisoesDoImovel(admin, par.owner_id, par.property_id, true)) > 0) avisados++;
  }
  return avisados;
}
