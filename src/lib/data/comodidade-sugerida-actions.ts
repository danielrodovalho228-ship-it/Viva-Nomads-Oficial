"use server";

/**
 * E101 (detecção na edição): na página "Nível, ruído e extras" não há o "Salvar" do anúncio, então a comodidade que o
 * dono confirma na sugestão das fotos é gravada aqui mesmo, na hora — só no imóvel dele e só com chave do catálogo.
 */
import { createClient } from "@/lib/supabase/server";
import { AMENITY_CATEGORY, AMENITY_LABEL, amenityKeysFromLabels } from "@/lib/amenities";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function meuImovel(propertyId: string) {
  if (!UUID.test(propertyId ?? "")) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("properties").select("owner_id").eq("id", propertyId).maybeSingle();
  return data?.owner_id === user.id ? supabase : null;
}

/** As chaves das comodidades que o anúncio já tem (para a sugestão não repetir o que está marcado). */
export async function comodidadesDoMeuImovel(propertyId: string): Promise<string[]> {
  const supabase = await meuImovel(propertyId);
  if (!supabase) return [];
  const { data } = await supabase.from("property_amenities").select("label").eq("property_id", propertyId);
  return amenityKeysFromLabels(((data as { label: string }[] | null) ?? []).map((r) => r.label));
}

/** Grava a comodidade confirmada (idempotente: se já existe, não duplica). */
export async function gravarComodidadeConfirmada(propertyId: string, chave: string): Promise<{ ok: boolean }> {
  const supabase = await meuImovel(propertyId);
  const label = AMENITY_LABEL[chave];
  if (!supabase || !label) return { ok: false };
  const { data } = await supabase.from("property_amenities").select("label").eq("property_id", propertyId).eq("label", label).maybeSingle();
  if (data) return { ok: true };
  const { count } = await supabase.from("property_amenities").select("label", { count: "exact", head: true }).eq("property_id", propertyId);
  const { error } = await supabase.from("property_amenities").insert({ property_id: propertyId, category: AMENITY_CATEGORY[chave], label, sort_order: count ?? 0 });
  return { ok: !error };
}
