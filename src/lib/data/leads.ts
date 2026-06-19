import { createClient } from "@/lib/supabase/server";
import { SAMPLE_LEADS, type Lead, type Light } from "./lead-types";

// Re-exporta os utilitários puros para compatibilidade com importações server-side.
export { SAMPLE_LEADS, LIGHT_SHORT, leadScore, leadSummary } from "./lead-types";
export type { Lead, Light } from "./lead-types";

interface LeadRow {
  id: string;
  status: string;
  tenant: { full_name: string | null; email: string | null; phone: string | null; professional_category: string | null; linkedin_url: string | null } | null;
  property: { title: string | null } | null;
  verification: { traffic_light: Light | null; risk_categories: string[] | null }[] | null;
}

/** Lista os leads do proprietário logado (Supabase) ou exemplos (demo). */
export async function listLeads(): Promise<Lead[]> {
  const supabase = await createClient();
  if (!supabase) return SAMPLE_LEADS;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return SAMPLE_LEADS;

  const { data, error } = await supabase
    .from("leads")
    .select(
      `id, status,
       tenant:profiles!leads_tenant_id_fkey ( full_name, email, phone, professional_category, linkedin_url ),
       property:properties!leads_property_id_fkey ( title ),
       verification:tenant_verifications ( traffic_light, risk_categories )`
    )
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) return SAMPLE_LEADS;

  return (data as unknown as LeadRow[]).map((r) => {
    const v = r.verification?.[0];
    return {
      id: r.id,
      name: r.tenant?.full_name ?? "Inquilino",
      property: r.property?.title ?? "Imóvel",
      category: r.tenant?.professional_category ?? "—",
      riskCategories: v?.risk_categories ?? ["Verificação pendente"],
      light: v?.traffic_light ?? "yellow",
      verified: !!v?.traffic_light,
      linkedin: r.tenant?.linkedin_url ?? undefined,
      phone: r.tenant?.phone ?? "—",
      email: r.tenant?.email ?? "—",
    };
  });
}
