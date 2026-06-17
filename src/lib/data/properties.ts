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
