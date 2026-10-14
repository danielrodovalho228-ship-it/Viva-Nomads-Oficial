import { createClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Tipo de acesso declarado no anúncio do contrato (ordem f92bc582, item 3). Leitura pelo RLS: quem não é parte
 * recebe null. Consulta separada de propósito: se a coluna faltar no banco, só o lembrete some, o contrato abre.
 */
export async function tipoAcessoDoContrato(contratoId: string): Promise<string | null> {
  if (!UUID_RE.test(contratoId)) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("contratos").select("properties(tipo_acesso)").eq("id", contratoId).maybeSingle();
  if (error || !data) return null;
  const p = (data as unknown as { properties: { tipo_acesso?: string | null } | { tipo_acesso?: string | null }[] | null }).properties;
  const linha = Array.isArray(p) ? p[0] : p;
  return linha?.tipo_acesso ?? null;
}
