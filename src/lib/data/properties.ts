import { createClient } from "@/lib/supabase/server";
import type { Property } from "@/lib/types";
import { SAMPLE_PROPERTIES } from "@/lib/properties";

/*
  Camada de acesso a imóveis. Usa o Supabase quando configurado; caso
  contrário, cai para os dados de exemplo (modo demonstração).
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
  work_ready_badge: boolean;
  work_score: number;
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
    workReadyBadge: row.work_ready_badge,
    workScore: row.work_score,
    photos: [],
    amenities: [],
    workFeatures: [],
    nearbyWorkspaces: [],
    ownerName: "",
  };
}

export async function listProperties(): Promise<Property[]> {
  const supabase = await createClient();
  if (!supabase) return SAMPLE_PROPERTIES;

  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) return SAMPLE_PROPERTIES;
  return (data as PropertyRow[]).map(rowToProperty);
}

export async function getProperty(id: string): Promise<Property | undefined> {
  const supabase = await createClient();
  if (!supabase) return SAMPLE_PROPERTIES.find((p) => p.id === id);

  const { data, error } = await supabase.from("properties").select("*").eq("id", id).single();
  if (error || !data) return SAMPLE_PROPERTIES.find((p) => p.id === id);
  return rowToProperty(data as PropertyRow);
}

export async function listPropertiesByCity(city: string): Promise<Property[]> {
  const all = await listProperties();
  return all.filter((p) => p.city.toLowerCase() === city.toLowerCase());
}
