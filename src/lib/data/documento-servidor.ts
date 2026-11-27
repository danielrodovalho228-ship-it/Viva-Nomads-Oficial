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

/** E574: a declaração do proprietário PJ sobre a nota fiscal da locação (null = não respondeu; sem a 0294 = null). */
export async function lerNotaLocacao(admin: SupabaseClient, userId: string): Promise<boolean | null> {
  const r = await admin.from("profiles").select("emite_nota_locacao").eq("id", userId).maybeSingle();
  if (r.error) return null;
  const v = (r.data as { emite_nota_locacao?: boolean | null } | null)?.emite_nota_locacao;
  return typeof v === "boolean" ? v : null;
}
