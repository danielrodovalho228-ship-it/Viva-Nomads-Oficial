import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { documentosInquilinoCompletos } from "@/lib/documentos-inquilino";

export const BUCKET_DOCS_INQUILINO = "inquilino-docs";

/**
 * Tipos já enviados pelo inquilino nesta candidatura (service role). null = a
 * tabela ainda não existe (0093 não aplicada) — quem chama NÃO trava por isso.
 */
export async function tiposEnviados(admin: SupabaseClient, leadId: string): Promise<string[] | null> {
  const { data, error } = await admin.from("documentos_inquilino").select("tipo").eq("lead_id", leadId);
  if (error) return null;
  return (data ?? []).map((d) => d.tipo as string);
}

/** true/false = completos ou não; null = não dá para saber (sem a 0093) → não trava. */
export async function docsInquilinoCompletos(admin: SupabaseClient, leadId: string): Promise<boolean | null> {
  const tipos = await tiposEnviados(admin, leadId);
  return tipos === null ? null : documentosInquilinoCompletos(tipos);
}
