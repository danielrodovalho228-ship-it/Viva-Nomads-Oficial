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
import { listingLimit, PLAN_LABEL } from "@/lib/plan";
import type { SubscriptionPlan } from "@/lib/store";
import { buildLeadNotification, LEAD_KIND_MSG, type LeadKind } from "@/lib/leads";
import { amenityRows } from "@/lib/amenities";
import { getPropertyForOwner } from "@/lib/data/properties";
import type { Property } from "@/lib/types";

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
      condo_allows: elig.condoAllows || "unknown",
      eligible,
      // Selo base + etiquetas (Atualização 11)
      ready_to_live_score,
      ready_to_live_badge: ready_to_live_score >= 70,
      tag_home_office: tagHomeOffice(quality),
      tag_work_located: tagWorkLocated(quality),
      tag_condo_approved: tagCondoApproved(elig),
      internet_tier: quality.internetTier,
      status: eligible ? "approved" : "not_eligible",
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id };
}

/** Cria um imóvel (Fase 5), exigindo um checklist aprovado. */
export interface PropertyInput {
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
  /** Faixas de prazo aceitas (temporada, media_estadia, longa). */
  faixasAceitas?: string[];
  /** Garantias que o proprietário aceita (caucao_avista, caucao_parcelada, titulo, seguro_fianca). */
  garantiasAceitas?: string[];
  prepFee?: number;
  lat?: number;
  lng?: number;
  photoUrls?: string[];
  videoUrl?: string;
  /**
   * Salvar como rascunho (não publicar). Padrão: false = publica direto.
   * Publicar grava status "active" — é o que torna o imóvel visível na busca
   * pública (que filtra status='active'). Rascunho fica "draft" e só aparece
   * no painel do dono.
   */
  asDraft?: boolean;
  // ── Enriquecimento (FASE 1/2) — gravados best-effort (requer migrações 0018/0019) ──
  parkingSpots?: number;
  condoFee?: number;
  availableFrom?: string;
  availableUntil?: string;
  maxPeriodDays?: number;
  furnished?: boolean;
  petsAllowed?: boolean;
  smokingAllowed?: boolean;
  childrenAllowed?: boolean;
  maxGuests?: number;
  /** Chaves de comodidade selecionadas (catálogo único). */
  amenityKeys?: string[];
  /** Proximidades Google curadas (só place_id + categoria + rótulo). */
  googlePlaces?: { placeId: string; categoria: string; rotulo?: string }[];
  /** Proximidades manuais (nome + distância digitados). */
  proximities?: { category: string; name: string; note?: string }[];
}

export async function createProperty(input: PropertyInput): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado." };

  // Feature gating por plano (validado no servidor): respeita o limite de
  // anúncios do plano do proprietário. Sem assinatura, vale o plano gratuito.
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();
  const plan = (sub?.plan ?? "free") as SubscriptionPlan;
  const { count } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);
  if ((count ?? 0) >= listingLimit(plan)) {
    return {
      ok: false,
      error: `Seu plano (${PLAN_LABEL[plan]}) permite até ${listingLimit(plan)} anúncio(s). Faça upgrade para publicar mais.`,
    };
  }

  const { data, error } = await supabase
    .from("properties")
    .insert({
      owner_id: user.id,
      title: input.title,
      description: input.description,
      property_type: input.propertyType,
      city: input.city,
      address: input.neighborhood,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      area_m2: input.areaM2,
      min_period_days: input.minPeriodDays,
      monthly_price: input.monthlyPrice,
      // Publicar => "active" (visível na busca pública); rascunho => "draft".
      status: input.asDraft ? "draft" : "active",
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
      garantias_aceitas: input.garantiasAceitas ?? [],
      prep_fee: input.prepFee ?? 0,
      video_url: input.videoUrl ?? null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  // Enriquecimento (campos das migrações 0018/0019). Best-effort: se a migração
  // ainda não rodou, o update falha em silêncio mas o imóvel já foi criado.
  try {
    await supabase
      .from("properties")
      .update({
        parking_spots: input.parkingSpots ?? 0,
        condo_fee: input.condoFee ?? 0,
        available_from: input.availableFrom ?? null,
        available_until: input.availableUntil ?? null,
        max_period_days: input.maxPeriodDays ?? null,
        furnished: input.furnished ?? true,
        pets_allowed: input.petsAllowed ?? null,
        smoking_allowed: input.smokingAllowed ?? false,
        children_allowed: input.childrenAllowed ?? null,
        max_guests: input.maxGuests ?? null,
        faixas_aceitas: input.faixasAceitas ?? [],
        google_places: (input.googlePlaces ?? []).map((g) => ({
          place_id: g.placeId,
          categoria: g.categoria,
          rotulo: g.rotulo,
        })),
      })
      .eq("id", data.id);
  } catch {
    /* migração 0018/0019/0020 ausente — segue sem os campos extras */
  }

  // Comodidades por categoria (catálogo único). Best-effort.
  if (input.amenityKeys && input.amenityKeys.length > 0) {
    const rows = amenityRows(input.amenityKeys);
    if (rows.length > 0) {
      try {
        await supabase.from("property_amenities").insert(
          rows.map((r, i) => ({
            property_id: data.id,
            category: r.category,
            label: r.label,
            sort_order: i,
          }))
        );
      } catch {
        /* tabela ausente — segue sem comodidades */
      }
    }
  }

  // Proximidades manuais (nome + distância). Best-effort.
  if (input.proximities && input.proximities.length > 0) {
    try {
      await supabase.from("property_proximities").insert(
        input.proximities.map((p, i) => ({
          property_id: data.id,
          category: p.category,
          name: p.name,
          note: p.note ?? null,
          sort_order: i,
        }))
      );
    } catch {
      /* tabela ausente — segue sem proximidades */
    }
  }

  // Persiste as fotos enviadas ao Storage (a primeira é a capa). Ignora URLs
  // não persistentes (blob: do modo demo, ou upload que falhou) para não gravar
  // imagem quebrada. Best-effort: uma falha aqui não derruba o cadastro base.
  const persistableUrls = (input.photoUrls ?? []).filter((u) => u && !u.startsWith("blob:"));
  if (persistableUrls.length > 0) {
    try {
      const { error } = await supabase.from("property_photos").insert(
        persistableUrls.map((url, i) => ({
          property_id: data.id,
          url,
          sort_order: i,
        }))
      );
      if (error) console.error("[createProperty] falha ao gravar fotos:", error.message);
    } catch (e) {
      console.error("[createProperty] erro ao gravar fotos:", e);
    }
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

/** Carrega um imóvel do dono para edição (prefill do wizard). Serializável. */
export async function loadPropertyForEdit(id: string): Promise<Property | null> {
  const p = await getPropertyForOwner(id);
  return p ?? null;
}

/**
 * Atualiza um imóvel existente (edição). Espelha os campos de createProperty,
 * mas em UPDATE (escopo do dono via RLS) e re-sincroniza as tabelas filhas
 * (comodidades, proximidades, fotos) apagando e regravando. Best-effort nas
 * tabelas de enriquecimento — migração ausente não derruba a edição base.
 */
export async function updateProperty(id: string, input: PropertyInput): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado." };
  if (!UUID_RE.test(id)) return { ok: false, error: "Imóvel inválido para edição." };

  const { error } = await supabase
    .from("properties")
    .update({
      title: input.title,
      description: input.description,
      property_type: input.propertyType,
      city: input.city,
      address: input.neighborhood,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      area_m2: input.areaM2,
      min_period_days: input.minPeriodDays,
      monthly_price: input.monthlyPrice,
      // Só (re)publica se for explicitamente "Publicar"; "Salvar rascunho" não
      // despublica um anúncio já ativo.
      ...(input.asDraft === false ? { status: "active" } : {}),
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
      garantias_aceitas: input.garantiasAceitas ?? [],
      prep_fee: input.prepFee ?? 0,
      video_url: input.videoUrl ?? null,
    })
    .eq("id", id)
    .eq("owner_id", user.id);
  if (error) return { ok: false, error: error.message };

  // Enriquecimento (best-effort — requer migrações 0018/0019/0020).
  try {
    await supabase
      .from("properties")
      .update({
        parking_spots: input.parkingSpots ?? 0,
        condo_fee: input.condoFee ?? 0,
        available_from: input.availableFrom ?? null,
        available_until: input.availableUntil ?? null,
        max_period_days: input.maxPeriodDays ?? null,
        furnished: input.furnished ?? true,
        pets_allowed: input.petsAllowed ?? null,
        smoking_allowed: input.smokingAllowed ?? false,
        children_allowed: input.childrenAllowed ?? null,
        max_guests: input.maxGuests ?? null,
        faixas_aceitas: input.faixasAceitas ?? [],
        google_places: (input.googlePlaces ?? []).map((g) => ({
          place_id: g.placeId,
          categoria: g.categoria,
          rotulo: g.rotulo,
        })),
      })
      .eq("id", id)
      .eq("owner_id", user.id);
  } catch {
    /* migração ausente — segue sem os campos extras */
  }

  // Re-sincroniza tabelas filhas: apaga as atuais e regrava as do formulário.
  const resync = async (table: string, rows: Record<string, unknown>[]) => {
    try {
      await supabase.from(table).delete().eq("property_id", id);
      if (rows.length > 0) await supabase.from(table).insert(rows);
    } catch {
      /* tabela ausente — ignora */
    }
  };
  await resync(
    "property_amenities",
    amenityRows(input.amenityKeys ?? []).map((r, i) => ({
      property_id: id,
      category: r.category,
      label: r.label,
      sort_order: i,
    }))
  );
  await resync(
    "property_proximities",
    (input.proximities ?? []).map((p, i) => ({
      property_id: id,
      category: p.category,
      name: p.name,
      note: p.note ?? null,
      sort_order: i,
    }))
  );
  await resync(
    "property_photos",
    (input.photoUrls ?? [])
      .filter((u) => u && !u.startsWith("blob:"))
      .map((url, i) => ({ property_id: id, url, sort_order: i }))
  );

  return { ok: true, id };
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Registra o interesse de um inquilino (dúvida, visita ou candidatura) e AVISA
 * o proprietário por e-mail/WhatsApp — o canal real do funil.
 *
 * Resolve o dono automaticamente: imóvel real (id uuid no banco) usa o owner_id
 * da linha; imóvel demo (id textual, fora do banco) vai para o dono configurado
 * (DEMO_OWNER_EMAIL — o super admin). Para imóveis reais também tenta gravar o
 * lead + abrir a conversa (best-effort; persiste quando a RLS de insert estiver
 * aplicada — ver migração 0017). Retorna `needsAuth` se o visitante não estiver
 * logado e `selfOwned` se for o próprio dono abrindo o anúncio.
 */
export async function requestLead(
  propertyId: string,
  propertyTitle: string,
  kind: LeadKind
): Promise<ActionResult & { needsAuth?: boolean; selfOwned?: boolean }> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, needsAuth: true, error: "Entre para falar com o proprietário." };

  const real = UUID_RE.test(propertyId);

  // Dono do imóvel: real → owner_id da linha; demo (ou perfil oculto pela RLS) →
  // e-mail configurado do super admin.
  let ownerId: string | null = null;
  let ownerEmail: string | null = null;
  let ownerPhone: string | null = null;
  let ownerName: string | null = null;
  if (real) {
    const { data: prop } = await supabase
      .from("properties")
      .select("owner_id")
      .eq("id", propertyId)
      .maybeSingle();
    ownerId = (prop?.owner_id as string | undefined) ?? null;
    if (ownerId) {
      // A RLS de `profiles` ("perfil próprio") bloqueia a sessão do inquilino de
      // ler o contato do dono. A RPC SECURITY DEFINER `owner_notify_contact`
      // (migração 0023) devolve o contato do dono de um anúncio ATIVO só para a
      // notificação. Enquanto a migração não roda, o erro cai no fallback abaixo.
      const { data: rpc } = await supabase.rpc("owner_notify_contact", { prop_id: propertyId });
      const o = Array.isArray(rpc) ? rpc[0] : rpc;
      ownerEmail = o?.email ?? null;
      ownerPhone = o?.phone ?? null;
      ownerName = o?.full_name ?? null;
    }
  }
  if (!ownerEmail) ownerEmail = process.env.DEMO_OWNER_EMAIL ?? "dtrodovalho40@gmail.com";

  // O próprio dono abrindo seu anúncio: não gera lead para si mesmo.
  if (ownerId && ownerId === user.id) return { ok: true, selfOwned: true };

  // Identidade do interessado (perfil próprio — permitido pela RLS).
  const { data: me } = await supabase
    .from("profiles")
    .select("full_name, email, phone")
    .eq("id", user.id)
    .maybeSingle();
  const tenantName = me?.full_name ?? user.email ?? "Interessado";
  const tenantEmail = me?.email ?? user.email ?? "";
  const tenantPhone = me?.phone ?? "";

  // Imóvel real: grava lead + abre conversa. Dedup por (imóvel, interessado)
  // para que cliques repetidos não criem leads/mensagens duplicados.
  if (real && ownerId) {
    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .eq("property_id", propertyId)
      .eq("tenant_id", user.id)
      .maybeSingle();
    if (!existing) {
      const { error: leadErr } = await supabase
        .from("leads")
        .insert({ property_id: propertyId, owner_id: ownerId, tenant_id: user.id, status: "new" });
      // 23505 = duplicado (corrida): não é erro real. Demais erros: registra.
      if (leadErr && leadErr.code !== "23505") {
        console.error("[requestLead] falha ao gravar lead:", leadErr.message);
      }
      const conversationId = [user.id, ownerId].sort().join("_") + `_${propertyId}`;
      const { error: msgErr } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        receiver_id: ownerId,
        property_id: propertyId,
        body: LEAD_KIND_MSG[kind](propertyTitle),
      });
      if (msgErr && msgErr.code !== "23505") {
        console.error("[requestLead] falha ao abrir conversa:", msgErr.message);
      }
    }
  }

  // Notifica o dono — SEMPRE (real e demo). É isto que faz os botões funcionarem
  // de verdade: o lead chega ao e-mail/WhatsApp do proprietário.
  const { detailsHtml, detailsText } = buildLeadNotification(kind, propertyTitle, {
    name: tenantName,
    email: tenantEmail,
    phone: tenantPhone,
  });
  await notify({
    event: "new_lead",
    email: ownerEmail ?? undefined,
    phone: ownerPhone ?? undefined,
    name: ownerName ?? undefined,
    detailsHtml,
    detailsText,
  });

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
