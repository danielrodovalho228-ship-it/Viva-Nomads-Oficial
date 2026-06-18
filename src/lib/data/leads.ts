import { createClient } from "@/lib/supabase/server";

export type Light = "green" | "yellow" | "red";

export interface Lead {
  id: string;
  name: string;
  property: string;
  category: string;
  riskCategories: string[];
  light: Light;
  verified: boolean;
  linkedin?: string;
  phone: string;
  email: string;
}

/** Leads de exemplo (fallback do modo demonstração). */
export const SAMPLE_LEADS: Lead[] = [
  {
    id: "1",
    name: "Ana C.",
    property: "Apto Santa Mônica",
    category: "Médica · residência",
    riskCategories: ["Identidade OK", "Sem ações relevantes"],
    light: "green",
    verified: true,
    linkedin: "https://linkedin.com/in/ana-exemplo",
    phone: "(34) 99999-0001",
    email: "ana@exemplo.com",
  },
  {
    id: "2",
    name: "Rafael L.",
    property: "Studio Centro",
    category: "Executivo em transferência",
    riskCategories: ["Identidade OK"],
    light: "green",
    verified: true,
    linkedin: "https://linkedin.com/in/rafael-exemplo",
    phone: "(34) 99999-0002",
    email: "rafael@exemplo.com",
  },
  {
    id: "3",
    name: "Júlia M.",
    property: "Apto Santa Mônica",
    category: "Nômade digital",
    riskCategories: ["Verificação pendente"],
    light: "yellow",
    verified: false,
    phone: "(34) 99999-0003",
    email: "julia@exemplo.com",
  },
];

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
