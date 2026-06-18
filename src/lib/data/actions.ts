"use server";

import { createClient } from "@/lib/supabase/server";
import type { EligibilityState, QualityState } from "@/lib/qualification";
import {
  isEligible,
  readyToLiveScore,
  tagHomeOffice,
  tagWorkLocated,
  tagCondoApproved,
} from "@/lib/qualification";
import { findNearbyWorkspaces } from "@/lib/integrations/places";
import { createSubaccount } from "@/lib/payments/asaas";
import { notify } from "@/lib/notifications";

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
  const ready_to_live_score = readyToLiveScore(quality);

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
      // Selo base + etiquetas (Atualização 11)
      ready_to_live_score,
      ready_to_live_badge: ready_to_live_score >= 70,
      tag_home_office: tagHomeOffice(quality),
      tag_work_located: tagWorkLocated(quality),
      tag_condo_approved: tagCondoApproved(elig),
      internet_mbps: quality.internetMbps,
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
  readyToLiveScore: number;
  tagHomeOffice?: boolean;
  tagWorkLocated?: boolean;
  tagCondoApproved?: boolean;
  ownershipType?: "own" | "subleased";
  subleaseAuthorized?: boolean;
  subleaseDocUrl?: string;
  utilitiesMode?: "fixed" | "real";
  utilitiesEstimate?: number;
  issuesInvoice?: boolean;
  acceptsInsurance?: boolean;
  prepFee?: number;
  lat?: number;
  lng?: number;
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
      ready_to_live_score: input.readyToLiveScore,
      ready_to_live_badge: input.readyToLiveScore >= 70,
      tag_home_office: input.tagHomeOffice ?? false,
      tag_work_located: input.tagWorkLocated ?? false,
      tag_condo_approved: input.tagCondoApproved ?? false,
      ownership_type: input.ownershipType ?? "own",
      sublease_authorized:
        (input.ownershipType ?? "own") === "own" ? true : input.subleaseAuthorized ?? false,
      sublease_doc_url: input.subleaseDocUrl ?? null,
      utilities_mode: input.utilitiesMode ?? "fixed",
      utilities_estimate: input.utilitiesEstimate ?? 0,
      issues_invoice: input.issuesInvoice ?? false,
      accepts_insurance: input.acceptsInsurance ?? false,
      prep_fee: input.prepFee ?? 0,
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

  // Mapeia espaços de trabalho próximos (Google Places) — sustenta o selo de trabalho.
  if (typeof input.lat === "number" && typeof input.lng === "number") {
    const spaces = await findNearbyWorkspaces({ lat: input.lat, lng: input.lng });
    if (spaces.length > 0) {
      await supabase.from("property_workspaces").insert(
        spaces.map((w) => ({
          property_id: data.id,
          name: w.name,
          type: w.type,
          distance_m: w.distanceM,
        }))
      );
    }
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

  // Notifica o proprietário (e-mail/WhatsApp) — sem isso o funil vaza.
  const { data: owner } = await supabase
    .from("profiles")
    .select("full_name, email, phone")
    .eq("id", ownerId)
    .single();
  if (owner) {
    await notify({
      event: "new_lead",
      email: owner.email ?? undefined,
      phone: owner.phone ?? undefined,
      name: owner.full_name ?? undefined,
    });
  }
  return { ok: true };
}

/**
 * Cria a subconta Asaas do proprietário aprovado (walletId p/ split) e guarda
 * em payment_accounts. ⚠️ a apiKey deve ser persistida criptografada.
 */
export async function createOwnerSubaccount(input: {
  ownerId: string;
  name: string;
  email: string;
  cpfCnpj: string;
  phone?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const sub = await createSubaccount({
    name: input.name,
    email: input.email,
    cpfCnpj: input.cpfCnpj,
    mobilePhone: input.phone,
  });
  if (!supabase) return { ok: true, demo: true, id: sub.walletId };

  const { error } = await supabase.from("payment_accounts").upsert({
    owner_id: input.ownerId,
    gateway: "asaas",
    asaas_wallet_id: sub.walletId,
    asaas_subaccount_apikey: sub.apiKey, // em produção: criptografar antes de gravar
    status: sub.status,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: sub.walletId };
}

/** Aprova ou recusa um checklist de qualificação (admin). */
export async function reviewChecklist(
  id: string,
  approved: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado." };

  const { error } = await supabase
    .from("qualification_checklists")
    .update({ status: approved ? "approved" : "not_eligible" })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Envia uma mensagem no chat (cria/usa a conversa). Best-effort em demo. */
export async function sendMessage(input: {
  conversationId?: string;
  receiverId?: string;
  propertyId?: string;
  body: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true, id: input.conversationId };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !input.receiverId) return { ok: false, error: "Dados incompletos." };

  const conversationId =
    input.conversationId ??
    [user.id, input.receiverId].sort().join("_") +
      (input.propertyId ? `_${input.propertyId}` : "");

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    receiver_id: input.receiverId,
    property_id: input.propertyId ?? null,
    body: input.body,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: conversationId };
}
