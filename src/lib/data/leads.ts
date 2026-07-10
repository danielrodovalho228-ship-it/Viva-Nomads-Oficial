import { createClient } from "@/lib/supabase/server";
import { categoriaLabel } from "@/config/categorias-profissionais";
import { SAMPLE_LEADS, type Lead, type Light } from "./lead-types";

// Re-exporta os utilitários puros para compatibilidade com importações server-side.
export { SAMPLE_LEADS, LIGHT_SHORT, leadScore, leadSummary } from "./lead-types";
export type { Lead, Light } from "./lead-types";

interface LeadRow {
  id: string;
  status: string;
  tenant: { full_name: string | null; professional_category: string | null } | null;
  property: { title: string | null } | null;
  verification: { traffic_light: Light | null; risk_categories: string[] | null }[] | null;
}

/** Só o primeiro nome (identidade pós-aceite: sem sobrenome/contato na lista). */
function primeiroNome(nome: string | null | undefined): string {
  const n = (nome || "").trim().split(/\s+/)[0];
  return n || "Interessado";
}

/**
 * Lista os leads do proprietário logado. No modo demonstração (sem Supabase)
 * mostra exemplos; no modo REAL nunca inventa leads — sem sessão, erro ou banco
 * vazio devolve lista vazia (a página mostra o estado "ainda sem leads").
 */
export async function listLeads(): Promise<Lead[]> {
  const supabase = await createClient();
  if (!supabase) return SAMPLE_LEADS;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("leads")
    .select(
      `id, status,
       tenant:profiles!leads_tenant_id_fkey ( full_name, professional_category ),
       property:properties!leads_property_id_fkey ( title ),
       verification:tenant_verifications ( traffic_light, risk_categories )`
    )
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return (data as unknown as LeadRow[]).map((r) => {
    const v = r.verification?.[0];
    return {
      id: r.id,
      name: primeiroNome(r.tenant?.full_name),
      property: r.property?.title ?? "Imóvel",
      category: categoriaLabel(r.tenant?.professional_category) || "—",
      riskCategories: v?.risk_categories ?? ["Verificação pendente"],
      light: v?.traffic_light ?? "yellow",
      verified: !!v?.traffic_light,
    };
  });
}
