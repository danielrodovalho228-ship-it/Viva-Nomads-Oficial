import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { validarChecklistEstrutura, type ChecklistEstrutura } from "@/lib/selos-estrutura";

/**
 * E225-A: a estrutura informada pelo proprietário, para o anúncio público. Leitura pública SÓ de anúncio ATIVO (a
 * mesma regra da RLS da 0228, conferida aqui também porque a leitura é do servidor). Sem linha, sem a 0228 ou anúncio
 * fora do ar: null (a seção não aparece).
 */
export async function estruturaPublicaDoImovel(propertyId: string): Promise<ChecklistEstrutura | null> {
  const admin = createAdminClient();
  if (!admin || !/^[0-9a-f-]{36}$/i.test(propertyId)) return null;
  try {
    const { data, error } = await admin
      .from("imovel_estrutura")
      .select("checklist, properties!inner(status)")
      .eq("property_id", propertyId)
      .eq("properties.status", "active")
      .maybeSingle();
    if (error || !data) return null;
    const v = validarChecklistEstrutura(data.checklist);
    return v.ok ? v.checklist : null;
  } catch {
    return null;
  }
}
