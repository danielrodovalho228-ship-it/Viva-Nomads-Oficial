import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { documentoCompleto, type PerfilDocumento } from "@/lib/documento-pessoa";

/**
 * Lê o documento de uma conta com o cliente de SERVIÇO (só no servidor — o
 * número inteiro nunca vai para o navegador). Antes da 0090 a coluna
 * cpf_representante não existe: lê sem ela (PJ fica incompleto até a 0090).
 */
export async function lerDocumento(admin: SupabaseClient, userId: string): Promise<PerfilDocumento | null> {
  const r = await admin.from("profiles").select("person_type, cpf, cnpj, company_name, cpf_representante").eq("id", userId).maybeSingle();
  if (!r.error) return (r.data as PerfilDocumento | null) ?? null;
  const r2 = await admin.from("profiles").select("person_type, cpf, cnpj, company_name").eq("id", userId).maybeSingle();
  return (r2.data as PerfilDocumento | null) ?? null;
}

export async function temDocumento(admin: SupabaseClient, userId: string): Promise<boolean> {
  return documentoCompleto(await lerDocumento(admin, userId));
}
