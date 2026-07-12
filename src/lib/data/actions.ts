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
import { guardContactInfo } from "@/lib/messages/contact-guard";
import { SITE_URL } from "@/lib/site";
import type { Property } from "@/lib/types";
import { COMMISSION_BY_PLAN } from "@/lib/constants";
import {
  resumoContrato,
  encadearDatas,
  addDiasISO,
  DIAS_POR_MES,
  MESES_POR_BLOCO_PADRAO,
  type BlocoComDatas,
} from "@/lib/contrato-blocos";

type ActionResult = { ok: boolean; demo?: boolean; id?: string; error?: string };

/** Persiste o checklist de qualificação (Fase 4). */
export async function saveQualification(
  elig: EligibilityState,
  quality: QualityState,
  documentPath?: string | null,
  documentHash?: string | null
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
      // Caminho do documento no bucket PRIVADO (migration 0041). Só a referência
      // — a exibição usa URL assinada. null quando não enviado.
      document_path: documentPath ?? null,
      // Impressão digital do arquivo (0044) — detecta reuso entre contas na
      // conferência. Carimbo de quando foi enviado (distinto do created_at).
      document_hash_sha256: documentPath ? (documentHash ?? null) : null,
      document_uploaded_at: documentPath ? new Date().toISOString() : null,
      // Anti-fraude (migration 0042): documento enviado entra "em análise"; um
      // admin aprova/recusa. Só aprovado libera Publicar. Sem documento: none.
      document_status: documentPath ? "pending" : "none",
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

  // Documento entrou na fila → avisa os admins (best-effort; nunca trava nem
  // vaza dados do documento — só o fato de que há item para conferir).
  if (documentPath) {
    try {
      const { data: admins } = await supabase
        .from("profiles")
        .select("email, full_name, notif_email")
        .eq("role", "admin");
      for (const a of admins ?? []) {
        if (a.email && a.notif_email !== false) {
          await notify({
            event: "documento_recebido",
            email: a.email as string,
            name: (a.full_name as string) ?? undefined,
          });
        }
      }
    } catch {
      /* best-effort */
    }
  }
  return { ok: true, id: data.id };
}

export type DocumentStatus = "none" | "pending" | "approved" | "rejected";

/**
 * Estado da verificação do documento do proprietário logado (última
 * qualificação). O editor usa isto para o portão de Publicar (item 1 do QA):
 * só `approved` libera. Em demo/preview (sem Supabase) devolve `approved` para
 * não travar os fluxos de demonstração.
 */
export async function getMyDocumentStatus(): Promise<{ status: DocumentStatus; reason: string | null }> {
  const supabase = await createClient();
  if (!supabase) return { status: "approved", reason: null };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "none", reason: null };
  const { data } = await supabase
    .from("qualification_checklists")
    .select("document_status, document_review_reason")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    status: ((data?.document_status as DocumentStatus) ?? "none"),
    reason: (data?.document_review_reason as string) ?? null,
  };
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
  descricaoGeradaPorIa?: boolean;
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

  // Portão anti-fraude NO SERVIDOR (item 1): publicar (status active) exige a
  // última qualificação com documento APROVADO. Rascunho passa. Enforcement real
  // — o gate do cliente é só UX.
  if (input.asDraft === false) {
    const { data: q } = await supabase
      .from("qualification_checklists")
      .select("document_status")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if ((q?.document_status ?? "none") !== "approved") {
      return {
        ok: false,
        error: "Documentação do imóvel ainda não aprovada. Salve como rascunho — a publicação libera após a verificação.",
      };
    }
  }

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
        descricao_gerada_por_ia: input.descricaoGeradaPorIa ?? false,
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
        descricao_gerada_por_ia: input.descricaoGeradaPorIa ?? false,
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

export interface LocacaoInput {
  propertyId: string;
  faixa: string; // temporada | media_estadia | longa
  modeloContratoId?: string | null;
  periodoDias: number;
  valorTotal: number; // aluguel × meses (base da caução)
  caucaoValor: number; // 50% do valor total (Onda 1)
  garantia: string; // caucao_avista | caucao_parcelada | seguro_fianca
  qtdOcupantes: number;
  capacidadeSnapshot?: number | null;
}

/**
 * Registra a locação (Onda 1) na tabela `locacoes` ao fechar o contrato: nº de
 * ocupantes (cláusula de ocupação), caução (50% do total), garantia, faixa e o
 * modelo de contrato selecionado. Best-effort: em modo demo (sem Supabase),
 * imóvel não-UUID (exemplos) ou visitante sem sessão, é no-op — não grava nada.
 */
export async function registrarLocacao(input: LocacaoInput): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Faça login para registrar a locação." };
  // Imóvel de exemplo (id textual) ou fluxo mock → não persiste.
  if (!UUID_RE.test(input.propertyId)) return { ok: true, demo: true };
  const { data, error } = await supabase
    .from("locacoes")
    .insert({
      property_id: input.propertyId,
      tenant_id: user.id,
      faixa: input.faixa,
      modelo_contrato_id: input.modeloContratoId ?? null,
      periodo_dias: Math.round(input.periodoDias),
      valor_total: input.valorTotal,
      caucao_valor: input.caucaoValor,
      garantia: input.garantia,
      qtd_ocupantes: Math.round(input.qtdOcupantes),
      capacidade_snapshot: input.capacidadeSnapshot ?? null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id };
}

// ── Contrato fracionado em blocos (v2) ───────────────────────────────────────

export interface ContratoInput {
  propertyId: string;
  faixa: string; // temporada | media_estadia | longa
  ownerPlan: string; // plano do proprietário → taxa de comissão
  prazoTotalMeses: number; // prazo total pretendido (contrato-mãe)
  aluguelMensal: number;
  tamanhoBlocoMeses?: number; // padrão 2 (≤ 3 = 90 dias)
  qtdOcupantes: number;
  capacidadeSnapshot?: number | null;
  inicioISO: string; // data de início do 1º bloco (yyyy-mm-dd)
  caucaoForma?: "avista" | "preauth_cartao";
}

/**
 * Registra o CONTRATO-MÃE + seus BLOCOS no fechamento. A comissão (1 mês × taxa
 * do plano, UMA vez) fica no contrato-mãe — renovar/estender blocos não recobra.
 * Cada bloco carrega a caução (50% do valor do bloco); a plataforma só calcula e
 * documenta, NUNCA captura o dinheiro (regra de ouro). Best-effort: no-op em
 * demo (sem Supabase), imóvel não-UUID (exemplos) ou visitante sem sessão.
 */
export async function registrarContrato(
  input: ContratoInput
): Promise<ActionResult & { blocos?: number }> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Faça login para registrar o contrato." };
  if (!UUID_RE.test(input.propertyId)) return { ok: true, demo: true };

  const rate = COMMISSION_BY_PLAN[input.ownerPlan] ?? COMMISSION_BY_PLAN.free;
  const tamanho = input.tamanhoBlocoMeses ?? MESES_POR_BLOCO_PADRAO;
  const resumo = resumoContrato(input.prazoTotalMeses, input.aluguelMensal, rate, tamanho);

  const { data: contrato, error: cErr } = await supabase
    .from("contratos")
    .insert({
      property_id: input.propertyId,
      tenant_id: user.id,
      owner_plan: input.ownerPlan,
      faixa: input.faixa,
      prazo_total_dias: resumo.prazoTotalMeses * DIAS_POR_MES,
      aluguel_mensal: input.aluguelMensal,
      tamanho_bloco_meses: resumo.tamanhoBlocoMeses,
      comissao_percent: resumo.comissaoPercent,
      comissao_valor: resumo.comissaoValor,
      qtd_ocupantes: Math.round(input.qtdOcupantes),
      capacidade_snapshot: input.capacidadeSnapshot ?? null,
    })
    .select("id")
    .single();
  if (cErr) return { ok: false, error: cErr.message };

  const comDatas = encadearDatas(input.inicioISO, resumo.blocos);
  const rows = comDatas.map((b: BlocoComDatas, i) => ({
    contrato_id: contrato!.id,
    numero_bloco: b.numero,
    inicio: b.inicio,
    fim: b.fim,
    meses: b.meses,
    valor: b.valor,
    caucao: b.caucao,
    caucao_forma: input.caucaoForma ?? "avista",
    // 1º bloco entra vigente; os demais ficam agendados até a renovação opt-in.
    status: i === 0 ? "ativo" : "agendado",
  }));
  const { error: bErr } = await supabase.from("contrato_blocos").insert(rows);
  // Best-effort: o contrato-mãe já existe mesmo se a inserção dos blocos falhar.
  if (bErr) return { ok: true, id: contrato!.id, blocos: 0, error: bErr.message };
  return { ok: true, id: contrato!.id, blocos: rows.length };
}

/**
 * Renovação OPT-IN: cria o PRÓXIMO bloco do contrato-mãe (nunca automática —
 * requisito jurídico). Não gera nova comissão. Avisa a outra parte (best-effort;
 * o e-mail do dono vem da RPC `owner_notify_contact`). No-op em demo/sem sessão.
 */
export async function renovarBloco(
  contratoId: string
): Promise<ActionResult & { numeroBloco?: number }> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Faça login para renovar." };
  if (!UUID_RE.test(contratoId)) return { ok: true, demo: true };

  const { data: contrato, error: cErr } = await supabase
    .from("contratos")
    .select("id, property_id, aluguel_mensal, tamanho_bloco_meses, status")
    .eq("id", contratoId)
    .maybeSingle();
  if (cErr) return { ok: false, error: cErr.message };
  if (!contrato) return { ok: false, error: "Contrato não encontrado." };

  const { data: ultimo } = await supabase
    .from("contrato_blocos")
    .select("numero_bloco, fim")
    .eq("contrato_id", contratoId)
    .order("numero_bloco", { ascending: false })
    .limit(1)
    .maybeSingle();

  const meses = Math.min(3, Math.max(1, Number(contrato.tamanho_bloco_meses) || MESES_POR_BLOCO_PADRAO));
  const aluguel = Number(contrato.aluguel_mensal) || 0;
  const valor = aluguel * meses;
  const inicio = (ultimo?.fim as string | undefined) ?? hojeISO();
  const fim = addDiasISO(inicio, meses * DIAS_POR_MES);
  const numero = ((ultimo?.numero_bloco as number | undefined) ?? 0) + 1;

  const { error: bErr } = await supabase.from("contrato_blocos").insert({
    contrato_id: contratoId,
    numero_bloco: numero,
    inicio,
    fim,
    meses,
    valor,
    caucao: Math.round(valor * 0.5),
    status: "agendado",
  });
  if (bErr) return { ok: false, error: bErr.message };

  // Mantém o contrato-mãe ativo (renovou antes de encerrar).
  await supabase.from("contratos").update({ status: "ativo", encerrado_em: null }).eq("id", contratoId);

  // Avisa o proprietário (best-effort) — a outra ponta do opt-in.
  try {
    const { data: rpc } = await supabase.rpc("owner_notify_contact", {
      prop_id: contrato.property_id,
    });
    const o = Array.isArray(rpc) ? rpc[0] : rpc;
    if (o?.email) {
      await notify({
        event: "contract_status",
        email: o.email as string,
        name: (o.full_name as string) ?? undefined,
        detailsText: `O inquilino renovou a locação — bloco ${numero} (${inicio} a ${fim}).`,
      });
    }
  } catch {
    /* notificação é best-effort */
  }

  return { ok: true, numeroBloco: numero };
}

/**
 * Checagem LAZY do ciclo de blocos (roda ao abrir o painel; o pg_cron cobre
 * quando ninguém abre). Executa as transições de estado (encerramento por
 * NÃO-renovação, ativação de blocos vigentes) via a função SQL idempotente
 * `avancar_ciclo_blocos`. Best-effort e no-op em demo.
 */
export async function varrerCicloBlocos(): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const { error } = await supabase.rpc("avancar_ciclo_blocos");
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Data de hoje em ISO (yyyy-mm-dd) — isolada para manter as regras testáveis. */
function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

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

  // Proteção de contato: telefones/e-mails/links de mensageria são mascarados
  // ANTES de gravar — a negociação fica registrada na plataforma e o contato
  // direto só é liberado no fluxo oficial (após o aceite do proprietário).
  const { text: safeBody } = guardContactInfo(input.body);

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    receiver_id: input.receiverId,
    property_id: input.propertyId ?? null,
    body: safeBody,
  });
  if (error) return { ok: false, error: error.message };

  // Notifica o destinatário por e-mail com o LINK para responder NO SITE
  // (nunca por e-mail — mantém o registro). Best-effort: falha de notificação
  // não derruba o envio. O contato vem da RPC escopada (migração 0024); sem a
  // migração, segue sem notificar.
  try {
    const { data: rpc } = await supabase.rpc("message_notify_contact", {
      target: input.receiverId,
    });
    const contact = Array.isArray(rpc) ? rpc[0] : rpc;
    if (contact?.email) {
      const { data: me } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      // Identidade pós-aceite: só o PRIMEIRO nome no e-mail (nunca o sobrenome).
      const senderName = (me?.full_name ?? "").trim().split(/\s+/)[0] || "Um usuário";
      const preview = safeBody.length > 140 ? `${safeBody.slice(0, 140)}…` : safeBody;
      const link = `${SITE_URL}/dashboard/mensagens`;
      await notify({
        event: "new_message",
        email: contact.email,
        name: contact.full_name ?? undefined,
        detailsHtml:
          `<p><strong>${senderName}</strong> escreveu:</p>` +
          `<blockquote style="margin:8px 0;padding:8px 12px;border-left:3px solid #1e63d0;color:#374151">${preview}</blockquote>` +
          `<p><a href="${link}" style="display:inline-block;background:#1e63d0;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:600">Responder no Viva Nomads</a></p>` +
          `<p style="color:#6b7280;font-size:12px">Responda sempre pela plataforma — assim a conversa fica registrada e protegida. Não responda este e-mail.</p>`,
        detailsText: `${senderName}: ${preview}\n\nResponda pela plataforma (a conversa fica registrada): ${link}`,
      });
    }
  } catch {
    /* notificação é best-effort */
  }

  return { ok: true, id: conversationId };
}

/**
 * Exclui um imóvel do proprietário logado (usado para descartar RASCUNHOS).
 * Apaga as tabelas-filhas (best-effort) e a linha do imóvel — sempre escopado a
 * owner_id (a RLS reforça). Demo/preview: no-op de sucesso.
 */
export async function deleteProperty(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado." };

  for (const table of ["property_photos", "property_amenities", "property_proximities"]) {
    try {
      await supabase.from(table).delete().eq("property_id", id);
    } catch {
      /* tabela ausente — ignora */
    }
  }
  const { error } = await supabase.from("properties").delete().eq("id", id).eq("owner_id", user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Quantos RASCUNHOS o proprietário logado tem (para o "Novo anúncio" oferecer retomar). */
export async function countMyDrafts(): Promise<number> {
  const supabase = await createClient();
  if (!supabase) return 0;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  const { count } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .eq("status", "draft");
  return count ?? 0;
}

/**
 * Autosave do RASCUNHO no servidor (P0 — perda de dados). Faz upsert de uma
 * linha `properties` status='draft' guardando o estado COMPLETO do editor em
 * `draft_data` (migration 0043) + os poucos campos NOT NULL (title/city/price)
 * para o card de "Meus imóveis". Sem geocode, sem tabelas-filhas, sem checar
 * limite de plano (rascunho não consome vaga). Devolve o id do rascunho para as
 * próximas gravações atualizarem a mesma linha. Demo/preview: no-op de sucesso.
 */
export async function saveDraftData(snap: {
  id?: string | null;
  title?: string;
  city?: string;
  monthlyPrice?: number;
  data: unknown;
}): Promise<{ ok: boolean; id?: string; error?: string; demo?: boolean }> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado." };

  const fields = {
    owner_id: user.id,
    status: "draft" as const,
    title: (snap.title?.trim() || "Rascunho de anúncio").slice(0, 200),
    city: snap.city?.trim() || "Uberlândia",
    monthly_price: Number.isFinite(snap.monthlyPrice) ? (snap.monthlyPrice as number) : 0,
    draft_data: snap.data as object,
  };

  if (snap.id) {
    const { error } = await supabase
      .from("properties")
      .update(fields)
      .eq("id", snap.id)
      .eq("owner_id", user.id)
      .eq("status", "draft");
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: snap.id };
  }
  const { data, error } = await supabase.from("properties").insert(fields).select("id").single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id };
}

/** Carrega o estado salvo (draft_data) de um rascunho do dono, para retomar. */
export async function loadDraftData(id: string): Promise<unknown | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("properties")
    .select("draft_data")
    .eq("id", id)
    .eq("owner_id", user.id)
    .eq("status", "draft")
    .maybeSingle();
  return data?.draft_data ?? null;
}

/** Rascunho mais recente do dono (para "Novo anúncio detecta rascunho" e o card
 * de pendência da Visão geral). Devolve o snapshot completo (`data`) para o
 * cálculo honesto de "% completo". null se não houver. */
export async function getLatestDraft(): Promise<{
  id: string;
  title: string;
  data: unknown;
} | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("properties")
    .select("id, title, draft_data")
    .eq("owner_id", user.id)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data
    ? {
        id: data.id as string,
        title: (data.title as string) || "Rascunho de anúncio",
        data: data.draft_data ?? null,
      }
    : null;
}
