"use server";

import { createClient } from "@/lib/supabase/server";
import type { EligibilityState, QualityState } from "@/lib/qualification";
import { isEligible, computeScore } from "@/lib/qualification";

type ActionResult = { ok: boolean; demo?: boolean; id?: string; error?: string };

/** Persiste o checklist de qualificação (Fase 4). */
export async function saveQualification(
  elig: EligibilityState,
  quality: QualityState
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado." };

  const eligible = isEligible(elig);
  const work_score = computeScore(quality);

  const { data, error } = await supabase
    .from("qualification_checklists")
    .insert({
      owner_id: user.id,
      furnished: elig.furnished,
      accepts_30days: elig.accepts30days,
      iptu_ok: elig.iptuOk,
      habitable: elig.habitable,
      is_owner_or_agent: elig.isOwnerOrAgent,
      condo_allows: elig.condoAllows,
      eligible,
      has_home_office: quality.hasHomeOffice,
      has_desk: quality.hasDesk,
      has_chair: quality.hasChair,
      internet_mbps: quality.internetMbps,
      coworking_2km: quality.coworking2km,
      meeting_room: quality.meetingRoom,
      cafe_1km: quality.cafe1km,
      washer: quality.washer,
      full_kitchen: quality.fullKitchen,
      ac_bedrooms: quality.acBedrooms,
      pets_ok: quality.petsOk,
      work_score,
      status: eligible ? "approved" : "not_eligible",
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id };
}

/** Cria um imóvel (Fase 5), exigindo um checklist aprovado. */
export async function createProperty(input: {
  title: string;
  description: string;
  propertyType: string;
  city: string;
  neighborhood: string;
  bedrooms: number;
  bathrooms: number;
  areaM2: number;
  minPeriodDays: number;
  monthlyPrice: number;
  workScore: number;
  photoUrls?: string[];
}): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado." };

  const { data, error } = await supabase
    .from("properties")
    .insert({
      owner_id: user.id,
      title: input.title,
      description: input.description,
      property_type: input.propertyType,
      city: input.city,
      address: input.neighborhood,
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      area_m2: input.areaM2,
      min_period_days: input.minPeriodDays,
      monthly_price: input.monthlyPrice,
      status: "draft",
      work_score: input.workScore,
      work_ready_badge: input.workScore >= 70,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  // Persiste as fotos enviadas ao Storage (a primeira é a capa).
  if (input.photoUrls && input.photoUrls.length > 0) {
    await supabase.from("property_photos").insert(
      input.photoUrls.map((url, i) => ({
        property_id: data.id,
        url,
        sort_order: i,
      }))
    );
  }

  return { ok: true, id: data.id };
}

/** Adiciona ou remove um imóvel dos favoritos do inquilino. */
export async function toggleFavorite(
  propertyId: string,
  favorite: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado." };

  if (favorite) {
    const { error } = await supabase
      .from("favorites")
      .insert({ tenant_id: user.id, property_id: propertyId });
    if (error && error.code !== "23505") return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("tenant_id", user.id)
      .eq("property_id", propertyId);
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Registra uma consulta de inquilino como lead para o proprietário. */
export async function createLead(propertyId: string, ownerId: string): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado." };

  const { error } = await supabase
    .from("leads")
    .insert({ property_id: propertyId, owner_id: ownerId, tenant_id: user.id, status: "new" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
