import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import type { Property } from "@/lib/types";
import { SAMPLE_PROPERTIES } from "@/lib/properties";

/*
  Camada de acesso a imóveis. Usa o Supabase quando configurado; caso
  contrário, cai para os dados de exemplo (modo demonstração).

  Leituras PÚBLICAS (listProperties, getProperty, por cidade) usam o cliente
  anônimo SEM cookies — não forçam render dinâmico (evita DYNAMIC_SERVER_USAGE)
  e respeitam a RLS pública. Já listMyProperties usa o cliente de servidor com
  sessão (precisa de auth.uid()).
*/

interface PropertyRow {
  id: string;
  title: string;
  description: string | null;
  property_type: string | null;
  city: string;
  state: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  area_m2: number | null;
  min_period_days: number;
  monthly_price: number;
  utilities_mode: string | null;
  utilities_estimate: number | null;
  utilities_overage_margin: number | null;
  prep_fee: number | null;
  checkout_cleaning_enabled: boolean | null;
  checkout_cleaning_fee: number | null;
  issues_invoice: boolean | null;
  accepts_insurance: boolean | null;
  rating: number | null;
  review_count: number | null;
  status: string;
  ready_to_live_badge: boolean | null;
  ready_to_live_score: number | null;
  tag_home_office: boolean | null;
  tag_work_located: boolean | null;
  tag_condo_approved: boolean | null;
  ownership_type: string | null;
  sublease_authorized: boolean | null;
  video_url: string | null;
  created_at: string | null;
}

function rowToProperty(row: PropertyRow): Property {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    propertyType: row.property_type ?? "Imóvel",
    city: row.city,
    state: row.state ?? "",
    neighborhood: row.address ?? "",
    lat: row.lat ?? 0,
    lng: row.lng ?? 0,
    bedrooms: row.bedrooms ?? 0,
    bathrooms: row.bathrooms ?? 0,
    areaM2: row.area_m2 ?? 0,
    minPeriodDays: row.min_period_days,
    monthlyPrice: Number(row.monthly_price),
    utilitiesMode: (row.utilities_mode as Property["utilitiesMode"]) ?? "fixed",
    utilitiesEstimate: Number(row.utilities_estimate ?? 0),
    utilitiesOverageMargin: Number(row.utilities_overage_margin ?? 20),
    prepFee: Number(row.prep_fee ?? 0),
    checkoutCleaningEnabled: row.checkout_cleaning_enabled ?? false,
    checkoutCleaningFee: Number(row.checkout_cleaning_fee ?? 0),
    issuesInvoice: row.issues_invoice ?? false,
    acceptsInsurance: row.accepts_insurance ?? false,
    rating: Number(row.rating ?? 0),
    reviewCount: Number(row.review_count ?? 0),
    status: row.status as Property["status"],
    readyToLiveBadge: row.ready_to_live_badge ?? false,
    readyToLiveScore: Number(row.ready_to_live_score ?? 0),
    tagHomeOffice: row.tag_home_office ?? false,
    tagWorkLocated: row.tag_work_located ?? false,
    tagCondoApproved: row.tag_condo_approved ?? false,
    ownershipType: (row.ownership_type as Property["ownershipType"]) ?? "own",
    subleaseAuthorized: row.sublease_authorized ?? undefined,
    videoUrl: row.video_url ?? undefined,
    createdAt: row.created_at ?? undefined,
    photos: [],
    amenities: [],
    workFeatures: [],
    nearbyWorkspaces: [],
    ownerName: "",
  };
}

export async function listProperties(): Promise<Property[]> {
  const supabase = createPublicClient();
  // Modo demonstração (sem Supabase): dados de exemplo.
  if (!supabase) return SAMPLE_PROPERTIES;

  try {
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    // Acesso real: NUNCA cai nos dados de exemplo (não mistura demo com real).
    // Banco vazio ou erro → lista vazia, e não os 3 imóveis fictícios.
    if (error || !data) return [];
    return (data as PropertyRow[]).map(rowToProperty);
  } catch {
    // Falha de rede/consulta → lista vazia, nunca 500 nem dados de exemplo.
    return [];
  }
}

export async function getProperty(id: string): Promise<Property | undefined> {
  const supabase = createPublicClient();
  // Modo demonstração (sem Supabase): dados de exemplo.
  if (!supabase) return SAMPLE_PROPERTIES.find((p) => p.id === id);

  try {
    // `maybeSingle` devolve null (sem erro) para zero linhas — evita o PGRST116
    // do `.single()` virar 500. Só imóveis ATIVOS são públicos: rascunho/pausado
    // por URL direta → 404 (não vaza). id mal formado cai no catch → 404.
    const { data } = await supabase
      .from("properties")
      .select("*")
      .eq("id", id)
      .eq("status", "active")
      .maybeSingle();
    if (!data) return undefined;
    return rowToProperty(data as PropertyRow);
  } catch {
    return undefined;
  }
}

export async function listPropertiesByCity(city: string): Promise<Property[]> {
  const all = await listProperties();
  return all.filter((p) => p.city.toLowerCase() === city.toLowerCase());
}

/**
 * Imóveis do proprietário logado (todos os status — inclui rascunhos), para o
 * painel "Meus imóveis". No modo demonstração, devolve alguns exemplos.
 */
export async function listMyProperties(): Promise<Property[]> {
  const supabase = await createClient();
  // Modo demonstração (sem Supabase): exemplos para a UI ganhar vida.
  if (!supabase) return SAMPLE_PROPERTIES.slice(0, 3);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as PropertyRow[]).map(rowToProperty);
}
