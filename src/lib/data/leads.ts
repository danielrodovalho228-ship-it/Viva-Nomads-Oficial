import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { categoriaLabel } from "@/config/categorias-profissionais";
import { SAMPLE_LEADS, type Lead, type Light } from "./lead-types";

// Re-exporta os utilitários puros para compatibilidade com importações server-side.
export { SAMPLE_LEADS, LIGHT_SHORT, leadScore, leadSummary } from "./lead-types";
export type { Lead, Light } from "./lead-types";

interface LeadRow {
  id: string;
  status: string;
  tenant_id: string;
  tenant: { full_name: string | null; professional_category: string | null } | null;
  property: { title: string | null } | null;
}

interface VerificacaoRow {
  tenant_id: string;
  traffic_light: Light | null;
  risk_categories: string[] | null;
}

/** Só o primeiro nome — enquanto a candidatura NÃO foi aceita. */
function primeiroNome(nome: string | null | undefined): string {
  const n = (nome || "").trim().split(/\s+/)[0];
  return n || "Interessado";
}

/**
 * Nome exibido ao proprietário: nome COMPLETO após o aceite (identidade
 * revelada — nome + foto + verificação, NUNCA contato); só o primeiro nome
 * enquanto em aberto/recusado.
 */
function nomeExibido(nome: string | null | undefined, status: string): string {
  const completo = (nome || "").trim();
  if (status === "accepted" && completo) return completo;
  return primeiroNome(nome);
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
      `id, status, tenant_id,
       tenant:profiles!leads_tenant_id_fkey ( full_name, professional_category ),
       property:properties!leads_property_id_fkey ( title )`
    )
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  const rows = data as unknown as LeadRow[];

  // leads e tenant_verifications não têm FK entre si (o embed dava 400 e a
  // lista vinha vazia), e a RLS de tenant_verifications só deixa o admin ler.
  // Busca pelo servidor SÓ os inquilinos dos leads deste proprietário (a
  // verificação mais recente de cada um).
  const verificacoes = new Map<string, VerificacaoRow>();
  const admin = createAdminClient();
  const tenantIds = [...new Set(rows.map((r) => r.tenant_id))];
  if (admin && tenantIds.length > 0) {
    const { data: vs } = await admin
      .from("tenant_verifications")
      .select("tenant_id, traffic_light, risk_categories")
      .in("tenant_id", tenantIds)
      .order("created_at", { ascending: false });
    for (const v of (vs ?? []) as VerificacaoRow[]) {
      if (!verificacoes.has(v.tenant_id)) verificacoes.set(v.tenant_id, v);
    }
  }

  return rows.map((r) => {
    const v = verificacoes.get(r.tenant_id);
    return {
      id: r.id,
      status: r.status,
      name: nomeExibido(r.tenant?.full_name, r.status),
      property: r.property?.title ?? "Imóvel",
      category: categoriaLabel(r.tenant?.professional_category) || "—",
      riskCategories: v?.risk_categories ?? ["Verificação pendente"],
      light: v?.traffic_light ?? "yellow",
      verified: !!v?.traffic_light,
    };
  });
}
