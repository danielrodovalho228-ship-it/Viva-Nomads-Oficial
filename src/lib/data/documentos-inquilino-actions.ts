"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehAdmin } from "@/lib/data/admin-guard";
import { tipoDocValido, type TipoDocInquilino } from "@/lib/documentos-inquilino";
import { BUCKET_DOCS_INQUILINO } from "@/lib/data/documentos-inquilino-servidor";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LINK_TTL = 60 * 10; // 10 min

export interface DocInquilinoResumo {
  tipo: TipoDocInquilino;
  enviadoEm: string;
}

/** Quem pode ver os documentos desta candidatura: o inquilino, o dono ou o admin. */
async function parteDaCandidatura(leadId: string) {
  if (!UUID_RE.test(leadId)) return null;
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: lead } = await admin.from("leads").select("id, tenant_id, owner_id, status").eq("id", leadId).maybeSingle();
  if (!lead || lead.status !== "accepted") return null;
  const parte = lead.tenant_id === user.id || lead.owner_id === user.id || (await ehAdmin(supabase, user.id));
  return parte ? { admin, lead } : null;
}

/** Tipo e data de cada documento enviado (nunca o caminho do arquivo). */
export async function listarDocsInquilino(leadId: string): Promise<DocInquilinoResumo[]> {
  const ctx = await parteDaCandidatura(leadId);
  if (!ctx) return [];
  const { data, error } = await ctx.admin.from("documentos_inquilino").select("tipo, enviado_em").eq("lead_id", leadId).order("tipo");
  if (error) return [];
  return (data ?? []).map((d) => ({ tipo: d.tipo as TipoDocInquilino, enviadoEm: d.enviado_em as string }));
}

/** Link assinado de 10 minutos para abrir um documento (inquilino, dono ou admin). */
export async function linkDocInquilino(leadId: string, tipo: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!tipoDocValido(tipo)) return { ok: false, error: "Documento inválido." };
  const ctx = await parteDaCandidatura(leadId);
  if (!ctx) return { ok: false, error: "Sem permissão." };
  const { data: doc } = await ctx.admin.from("documentos_inquilino").select("caminho").eq("lead_id", leadId).eq("tipo", tipo).maybeSingle();
  if (!doc?.caminho) return { ok: false, error: "Documento não enviado." };
  const { data: s } = await ctx.admin.storage.from(BUCKET_DOCS_INQUILINO).createSignedUrl(doc.caminho as string, LINK_TTL);
  return s?.signedUrl ? { ok: true, url: s.signedUrl } : { ok: false, error: "Não foi possível abrir agora." };
}
