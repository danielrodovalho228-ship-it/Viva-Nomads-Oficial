"use server";

import { createClient } from "@/lib/supabase/server";
import { dentroDoLimite, HORA, DIA as DIA_SEGUNDOS } from "@/lib/limites";
import { textoEmail, textoPlano } from "@/lib/notifications/texto-seguro";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EligibilityState, QualityState } from "@/lib/qualification";
import {
  isEligible,
  readyToLiveScore,
  tagHomeOffice,
  tagWorkLocated,
  tagCondoApproved,
} from "@/lib/qualification";
import { findNearbyWorkspaces } from "@/lib/integrations/places";
import { notify } from "@/lib/notifications";
import { listingLimit, PLAN_LABEL } from "@/lib/plan";
import type { SubscriptionPlan } from "@/lib/store";
import { buildLeadNotification, LEAD_KIND_MSG, type LeadKind } from "@/lib/leads";
import { amenityRows } from "@/lib/amenities";
import { fotosDoDono, urlsDoRascunho } from "@/lib/fotos-anuncio";
import { taxaDoContrato } from "@/config/planos";
import { erroBancoPT } from "@/lib/erros-banco";
import { planoDoProprietario } from "@/lib/data/plano-efetivo";
import { avisarPedidosDoImovel } from "@/lib/data/pedidos-compat";
import { INTERNET_META } from "@/lib/internet";
import { getPropertyForOwner } from "@/lib/data/properties";
import { guardContactInfo } from "@/lib/messages/contact-guard";
import { isExemplo, EXEMPLO_SEM_CONTATO } from "@/lib/demo-listing";
import { conversationId as idConversa } from "@/lib/messages/conversation-id";
import { SITE_URL } from "@/lib/site";
import type { Property } from "@/lib/types";
import { hojeBR, dataBR } from "@/lib/utils";
import {
  resumoContrato,
  encadearDatas,
  addDiasISO,
  fimInclusivoISO,
  diasInclusivos,
  caucaoDoBloco,
  cabeNoPrazoMaximo,
  DIAS_POR_MES,
  MESES_POR_BLOCO_PADRAO,
  MAX_MESES_BLOCO,
  PRAZO_MIN_MESES,
  PRAZO_MAX_MESES,
  PRAZO_MAX_DIAS,
  type BlocoComDatas,
} from "@/lib/contrato-blocos";

type ActionResult = { ok: boolean; demo?: boolean; id?: string; error?: string };

/** Persiste o checklist de qualificação (Fase 4). */
export async function saveQualification(
  elig: EligibilityState,
  quality: QualityState,
  documentPath?: string | null,
  documentHash?: string | null,
  /** Imóvel qualificado (`/qualificar?imovel=<id>`). Sem ele, a qualificação
   *  fica à espera e é ligada ao PRÓXIMO imóvel criado (createProperty). */
  propertyId?: string | null
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado." };

  // A qualificação é do IMÓVEL: só de um imóvel do próprio dono (o banco
  // confere de novo — 0060).
  if (propertyId) {
    if (!UUID_RE.test(propertyId)) return { ok: false, error: "Imóvel inválido." };
    const { data: prop } = await supabase
      .from("properties")
      .select("id")
      .eq("id", propertyId)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!prop) return { ok: false, error: "Imóvel não encontrado." };
  }

  const eligible = isEligible(elig);
  const ready_to_live_score = readyToLiveScore(quality);

  const linha = {
    owner_id: user.id,
    property_id: propertyId ?? null,
    furnished: elig.furnished,
    accepts_30days: elig.accepts30days,
    iptu_ok: elig.iptuOk,
    habitable: elig.habitable,
    is_owner_or_agent: elig.isOwnerOrAgent,
    condo_allows: elig.condoAllows || "unknown",
    // Caminho do documento no bucket PRIVADO (migration 0041). Só a referência
    // — a exibição usa URL assinada. null quando não enviado: aí o banco herda o
    // documento (e a revisão) da qualificação anterior do mesmo imóvel (0072).
    document_path: documentPath ?? null,
    // Impressão digital do arquivo (0044) — detecta reuso entre contas na
    // conferência. Carimbo de quando foi enviado (distinto do created_at).
    document_hash_sha256: documentPath ? (documentHash ?? null) : null,
    document_uploaded_at: documentPath ? new Date().toISOString() : null,
    // Anti-fraude (migration 0042): documento enviado entra "em análise"; um
    // admin aprova/recusa. Só aprovado libera Publicar. O banco decide (0060/0072).
    document_status: documentPath ? "pending" : "none",
    eligible,
    // Selo base + etiquetas (Atualização 11)
    ready_to_live_score,
    ready_to_live_badge: ready_to_live_score >= 70,
    tag_home_office: tagHomeOffice(quality),
    tag_work_located: tagWorkLocated(quality),
    tag_condo_approved: tagCondoApproved(elig),
    internet_tier: quality.internetTier in INTERNET_META ? quality.internetTier : null,
    status: eligible ? "approved" : "not_eligible",
  };
  // O estado completo da tela (0072) — para o /qualificar abrir preenchido.
  let { data, error } = await supabase
    .from("qualification_checklists")
    .insert({ ...linha, formulario: { versao: 1, elig, quality } })
    .select("id")
    .single();
  // Sem a 0072 aplicada a coluna não existe: grava sem o formulário.
  if (error && (error.code === "PGRST204" || /formulario/.test(error.message))) {
    ({ data, error } = await supabase.from("qualification_checklists").insert(linha).select("id").single());
  }

  if (error) {
    // Nunca mostra a mensagem técnica do banco (em inglês) ao proprietário.
    console.error("[saveQualification] falha ao gravar:", error.message);
    return { ok: false, error: "Não foi possível salvar a qualificação agora. Tente novamente em instantes." };
  }

  // Documento entrou na fila → avisa os admins (best-effort; nunca trava nem
  // vaza dados do documento — só o fato de que há item para conferir).
  if (documentPath) {
    try {
      // Pelo servidor: a RLS de profiles só mostra o próprio perfil ao dono,
      // então a lista vinha vazia e o aviso nunca saía.
      const admin = createAdminClient();
      const { data: admins } = admin
        ? await admin.from("profiles").select("email, full_name, notif_email").eq("role", "admin")
        : { data: [] as { email: string | null; full_name: string | null; notif_email: boolean | null }[] };
      for (const a of admins ?? []) {
        if (a.email && a.notif_email !== false) {
          await notify({
            event: "documento_recebido",
            email: a.email as string,
            name: (a.full_name as string) ?? undefined,
            pushUrl: "/admin/documentos",
          });
        }
      }
    } catch {
      /* best-effort */
    }
  }
  return { ok: true, id: (data as { id: string }).id };
}

export type DocumentStatus = "none" | "pending" | "approved" | "rejected";

/**
 * Estado da verificação do documento do proprietário logado (última
 * qualificação). O editor usa isto para o portão de Publicar (item 1 do QA):
 * só `approved` libera. Em demo/preview (sem Supabase) devolve `approved` para
 * não travar os fluxos de demonstração.
 */
export async function getMyDocumentStatus(
  propertyId?: string | null
): Promise<{ status: DocumentStatus; reason: string | null }> {
  const supabase = await createClient();
  if (!supabase) return { status: "approved", reason: null };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "none", reason: null };
  // Por IMÓVEL: a qualificação dele; imóvel novo: a qualificação à espera
  // (ainda sem imóvel), que será ligada a ele ao criar.
  const q = await qualificacaoDoImovel(supabase, user.id, propertyId ?? null);
  return {
    status: ((q?.document_status as DocumentStatus) ?? "none"),
    reason: (q?.document_review_reason as string) ?? null,
  };
}

/**
 * Qualificação já salva deste imóvel (ou a que está à espera), para o
 * /qualificar abrir PREENCHIDO. Usa o formulário completo (0072); em linhas
 * antigas, refaz os requisitos pelas colunas. `temDocumento`: já há documento
 * enviado — a tela não pede de novo (salvar sem documento novo o mantém).
 */
export async function carregarQualificacao(
  propertyId?: string | null
): Promise<{ elig: EligibilityState; quality: Partial<QualityState> | null; temDocumento: boolean } | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  if (propertyId && !UUID_RE.test(propertyId)) return null;
  let q = supabase.from("qualification_checklists").select("*").eq("owner_id", user.id);
  q = propertyId ? q.eq("property_id", propertyId) : q.is("property_id", null);
  const { data } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  const temDocumento = !!data.document_path;
  const form = (data.formulario ?? null) as { elig?: Partial<EligibilityState>; quality?: Partial<QualityState> } | null;
  const condo = data.condo_allows as string | null;
  const elig: EligibilityState = {
    furnished: form?.elig?.furnished ?? !!data.furnished,
    accepts30days: form?.elig?.accepts30days ?? !!data.accepts_30days,
    iptuOk: form?.elig?.iptuOk ?? !!data.iptu_ok,
    habitable: form?.elig?.habitable ?? !!data.habitable,
    isOwnerOrAgent: form?.elig?.isOwnerOrAgent ?? !!data.is_owner_or_agent,
    hasDocument: temDocumento,
    condoAllows: (form?.elig?.condoAllows ??
      (condo === "yes" || condo === "no" || condo === "unknown" ? condo : "")) as EligibilityState["condoAllows"],
  };
  const quality: Partial<QualityState> | null =
    form?.quality ?? (data.internet_tier ? { internetTier: data.internet_tier as QualityState["internetTier"] } : null);
  return { elig, quality, temDocumento };
}

/** Título e endereço de um imóvel do PRÓPRIO dono (cabeçalho do /qualificar). */
export async function resumoImovelDoDono(
  id: string
): Promise<{ id: string; titulo: string; local: string; rascunho: boolean } | null> {
  const supabase = await createClient();
  if (!supabase || !UUID_RE.test(id)) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("properties")
    .select("id, title, address, city, status")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    titulo: (data.title as string) || "Imóvel sem título",
    local: [data.address, data.city].filter(Boolean).join(", "),
    rascunho: data.status === "draft",
  };
}

/**
 * Qualificação que vale para um imóvel: a mais recente LIGADA a ele; para um
 * imóvel ainda não criado (propertyId null), a mais recente do dono ainda sem
 * imóvel. Nunca a de outro imóvel (antes valia "a última do dono").
 */
async function qualificacaoDoImovel(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  ownerId: string,
  propertyId: string | null
): Promise<{ id: string; document_status: string | null; document_review_reason: string | null } | null> {
  let q = supabase
    .from("qualification_checklists")
    .select("id, document_status, document_review_reason")
    .eq("owner_id", ownerId);
  q = propertyId ? q.eq("property_id", propertyId) : q.is("property_id", null);
  const { data } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data as { id: string; document_status: string | null; document_review_reason: string | null } | null) ?? null;
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
  // — o gate do cliente é só UX. A3: vale sempre que NÃO for rascunho (antes só
  // com asDraft === false, e omitir o campo publicava sem aprovação). O banco
  // reforça a mesma regra (0056).
  // Qualificação POR IMÓVEL: a que está à espera (sem imóvel) é ligada a este
  // imóvel novo. Publicar exige que ELA tenha o documento aprovado.
  const qualificacao = await qualificacaoDoImovel(supabase, user.id, null);
  if (!input.asDraft && (qualificacao?.document_status ?? "none") !== "approved") {
    return {
      ok: false,
      error: "Documentação do imóvel ainda não aprovada. Salve como rascunho — a publicação libera após a verificação.",
    };
  }

  // Limite de anúncios ATIVOS do plano (rascunho e pausado não contam). Só
  // pesa quando o anúncio vai ser publicado agora.
  if (!input.asDraft) {
    const limite = await limiteDePublicacao(supabase, user.id, null);
    if (limite) return { ok: false, error: limite };
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
      // Nasce rascunho: a qualificação é ligada logo abaixo e só então o
      // imóvel é publicado (o banco confere o documento DESTE imóvel — 0060).
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
      garantias_aceitas: input.garantiasAceitas ?? [],
      prep_fee: input.prepFee ?? 0,
      video_url: input.videoUrl ?? null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: erroBancoPT(error) };

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
  const persistableUrls = fotosDoDono(input.photoUrls ?? [], user.id);
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

  // Liga a qualificação à espera a ESTE imóvel e aplica o status pedido (o
  // trigger copia selos/etiquetas dela e confere o documento ao publicar).
  if (qualificacao) {
    await supabase
      .from("qualification_checklists")
      .update({ property_id: data.id })
      .eq("id", qualificacao.id)
      .eq("owner_id", user.id)
      .is("property_id", null);
  }
  const { error: stErr } = await supabase
    .from("properties")
    .update({ status: input.asDraft ? "draft" : "active" })
    .eq("id", data.id);
  if (stErr && !input.asDraft) {
    return {
      ok: false,
      id: data.id,
      error: "O imóvel foi salvo como rascunho, mas não pôde ser publicado: " + erroBancoPT(stErr),
    };
  }
  // Publicado agora: avisa os pedidos ativos que ele atende (dono e inquilino).
  if (!input.asDraft) {
    try {
      await avisarPedidosDoImovel(data.id as string);
    } catch {
      /* best-effort */
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

  // A3: (re)publicar exige o documento APROVADO — o mesmo portão do createProperty
  // (antes a edição publicava sem checar). O banco reforça (0056).
  if (input.asDraft === false) {
    // Documento DESTE imóvel (não o último do dono).
    const q = await qualificacaoDoImovel(supabase, user.id, id);
    if ((q?.document_status ?? "none") !== "approved") {
      return {
        ok: false,
        error: "Documentação do imóvel ainda não aprovada. Salve como rascunho — a publicação libera após a verificação.",
      };
    }
  }

  // Publicar conta no limite de anúncios ATIVOS do plano (antes a edição
  // publicava sem checar).
  if (input.asDraft === false) {
    const limite = await limiteDePublicacao(supabase, user.id, id);
    if (limite) return { ok: false, error: limite };
  }

  // Status ANTES da edição: só a PUBLICAÇÃO (rascunho/pausado → ativo) avisa
  // os pedidos compatíveis — editar um anúncio já ativo não reenvia avisos.
  const { data: antes } = await supabase.from("properties").select("status").eq("id", id).maybeSingle();

  // Fotos ANTES do status: o banco só deixa publicar com 8 fotos gravadas em
  // property_photos (0009). Antes elas eram regravadas DEPOIS da mudança para
  // 'active', e o rascunho (fotos só no draft_data) nunca publicava.
  await sincronizarFotos(supabase, id, user.id, input.photoUrls ?? []);

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
      // despublica um anúncio já ativo. Ao publicar, ZERA o draft_data (ele guarda
      // a rua exata e a linha fica pública — C4/T1).
      ...(input.asDraft === false ? { status: "active", draft_data: null } : {}),
      ready_to_live_score: input.readyToLiveScore,
      ready_to_live_badge: input.readyToLiveScore >= 70,
      tag_home_office: input.tagHomeOffice ?? false,
      tag_work_located: input.tagWorkLocated ?? false,
      tag_condo_approved: input.tagCondoApproved ?? false,
      ownership_type: input.ownershipType ?? "own",
      sublease_authorized:
        (input.ownershipType ?? "own") === "own" ? true : input.subleaseAuthorized ?? false,
      // Só grava o documento de sublocação quando o dono enviou um nesta edição.
      // A edição não recarrega esse campo — mandar null por ausência APAGAVA o
      // documento a cada edição (mesmo padrão do risco do endereço).
      ...(input.subleaseDocUrl !== undefined ? { sublease_doc_url: input.subleaseDocUrl } : {}),
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
  if (error) return { ok: false, error: erroBancoPT(error) };

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

  if (input.asDraft === false && antes?.status !== "active") {
    try {
      await avisarPedidosDoImovel(id);
    } catch {
      /* best-effort */
    }
  }

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
  // Anúncio de exemplo: favorito fica só no aparelho (property_id é uuid).
  if (isExemplo(propertyId)) return { ok: true, demo: true };

  if (favorite) {
    const { error } = await supabase
      .from("favorites")
      .insert({ tenant_id: user.id, property_id: propertyId });
    if (error && error.code !== "23505") return { ok: false, error: erroBancoPT(error) };
  } else {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("tenant_id", user.id)
      .eq("property_id", propertyId);
    if (error) return { ok: false, error: erroBancoPT(error) };
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
  if (error) return { ok: false, error: erroBancoPT(error) };
  return { ok: true, id: data?.id };
}

// ── Contrato fracionado em blocos (v2) ───────────────────────────────────────

export interface ContratoInput {
  /** Candidatura ACEITA de onde o contrato nasce (inquilino, imóvel, aluguel e taxa vêm dela). */
  leadId: string;
  faixa: string; // temporada | media_estadia | longa
  prazoTotalMeses: number; // prazo total pretendido (contrato-mãe)
  tamanhoBlocoMeses?: number; // padrão 2 (≤ 3 = 90 dias)
  qtdOcupantes: number;
  capacidadeSnapshot?: number | null;
  inicioISO: string; // data de início do 1º bloco (yyyy-mm-dd)
  caucaoForma?: "avista" | "preauth_cartao";
}

const FAIXAS_CONTRATO = new Set(["temporada", "media_estadia", "longa"]);

/**
 * Registra o CONTRATO-MÃE + seus BLOCOS no fechamento. A comissão (1 mês × taxa
 * do plano, UMA vez) fica no contrato-mãe — renovar/estender blocos não recobra.
 * Cada bloco carrega a caução (50% do valor do bloco); a plataforma só calcula e
 * documenta, NUNCA captura o dinheiro (regra de ouro).
 *
 * A6: o contrato nasce da candidatura ACEITA do dono logado — inquilino
 * (tenant_id = o do lead; antes gravava o DONO como inquilino), imóvel, aluguel
 * (do anúncio) e taxa (congelada no aceite) vêm do banco, nunca da tela. Um
 * contrato por candidatura. Gravado pelo servidor (0057 tirou a escrita do
 * usuário em contratos/blocos).
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
  if (!UUID_RE.test(input.leadId)) return { ok: true, demo: true };

  const { data: lead } = await supabase
    .from("leads")
    .select("id, owner_id, tenant_id, property_id, accepted_plan, accepted_commission_rate")
    .eq("id", input.leadId)
    .eq("owner_id", user.id)
    .eq("status", "accepted")
    .maybeSingle();
  if (!lead) return { ok: false, error: "Candidatura aceita não encontrada." };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Serviço indisponível." };

  const { data: existente } = await admin.from("contratos").select("id").eq("lead_id", lead.id).maybeSingle();
  if (existente) return { ok: true, id: existente.id as string, blocos: 0 };

  const { data: imovel } = await admin
    .from("properties")
    .select("monthly_price, owner_id")
    .eq("id", lead.property_id)
    .maybeSingle();
  const aluguel = Number(imovel?.monthly_price);
  if (!imovel || imovel.owner_id !== user.id || !(aluguel > 0)) {
    return { ok: false, error: "Imóvel sem valor de aluguel." };
  }

  const prazo = Math.round(Number(input.prazoTotalMeses));
  if (!(prazo >= PRAZO_MIN_MESES && prazo <= PRAZO_MAX_MESES))
    return { ok: false, error: `Prazo inválido (${PRAZO_MIN_MESES} a ${PRAZO_MAX_MESES} meses, até ${PRAZO_MAX_DIAS} dias).` };
  if (!FAIXAS_CONTRATO.has(input.faixa)) return { ok: false, error: "Faixa de prazo inválida." };
  const ocupantes = Math.round(Number(input.qtdOcupantes));
  if (!(ocupantes >= 1 && ocupantes <= 20)) return { ok: false, error: "Número de ocupantes inválido." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.inicioISO)) return { ok: false, error: "Data de início inválida." };

  const plano = (lead.accepted_plan as string) ?? "free";
  // NULL cai para a taxa do plano no aceite (antes Number(null) = 0 = Gestor).
  const rate = taxaDoContrato(lead.accepted_commission_rate, lead.accepted_plan);
  const tamanho = Math.min(3, Math.max(1, Math.round(Number(input.tamanhoBlocoMeses ?? MESES_POR_BLOCO_PADRAO))));
  const resumo = resumoContrato(prazo, aluguel, rate, tamanho);

  const { data: contrato, error: cErr } = await admin
    .from("contratos")
    .insert({
      lead_id: lead.id,
      property_id: lead.property_id,
      tenant_id: lead.tenant_id,
      owner_plan: plano,
      faixa: input.faixa,
      prazo_total_dias: resumo.prazoTotalMeses * DIAS_POR_MES,
      aluguel_mensal: aluguel,
      tamanho_bloco_meses: resumo.tamanhoBlocoMeses,
      comissao_percent: resumo.comissaoPercent,
      comissao_valor: resumo.comissaoValor,
      qtd_ocupantes: ocupantes,
      capacidade_snapshot: input.capacidadeSnapshot ?? null,
    })
    .select("id")
    .single();
  if (cErr) return { ok: false, error: "Não foi possível registrar o contrato." };

  const comDatas = encadearDatas(input.inicioISO, resumo.blocos);
  const rows = comDatas.map((b: BlocoComDatas, i) => ({
    contrato_id: contrato!.id,
    numero_bloco: b.numero,
    inicio: b.inicio,
    fim: b.fim,
    meses: b.meses,
    valor: b.valor,
    caucao: b.caucao,
    caucao_forma: input.caucaoForma === "preauth_cartao" ? "preauth_cartao" : "avista",
    // 1º bloco entra vigente; os demais ficam PENDENTES DE ACEITE das duas
    // partes (antes "agendado" — o ciclo diário os ativava sozinho).
    status: i === 0 ? "ativo" : "pendente_aceite",
  }));
  const { error: bErr } = await admin.from("contrato_blocos").insert(rows);
  // Best-effort: o contrato-mãe já existe mesmo se a inserção dos blocos falhar.
  if (bErr) return { ok: true, id: contrato!.id, blocos: 0, error: erroBancoPT(bErr) };
  return { ok: true, id: contrato!.id, blocos: rows.length };
}

/**
 * Renovação com ACEITE DAS DUAS PARTES (nunca automática — requisito jurídico).
 * Quem chama (proprietário ou inquilino do contrato) dá o SEU aceite ao
 * próximo bloco:
 *  • havendo bloco "pendente_aceite", registra o aceite desta parte; com os
 *    dois aceites o bloco vira "agendado" (e o ciclo diário o ativa na data);
 *  • não havendo, propõe um novo bloco — se couber no teto de 180 dias — já
 *    com o aceite de quem propôs, e avisa a outra parte.
 * Caução do bloco limitada para a soma do contrato não passar de 3 aluguéis
 * (art. 38 §2º). Não gera nova comissão. O banco confere tudo de novo (0063).
 */
export async function renovarBloco(
  contratoId: string
): Promise<ActionResult & { numeroBloco?: number; aguardandoOutraParte?: boolean }> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Faça login para renovar." };
  if (!UUID_RE.test(contratoId)) return { ok: true, demo: true };

  const { data: contrato, error: cErr } = await supabase
    .from("contratos")
    .select("id, property_id, tenant_id, aluguel_mensal, tamanho_bloco_meses, status")
    .eq("id", contratoId)
    .maybeSingle();
  if (cErr) return { ok: false, error: "Não foi possível ler o contrato." };
  // A leitura acima já passa pela RLS (só as partes do contrato veem).
  if (!contrato) return { ok: false, error: "Contrato não encontrado." };
  if (contrato.status !== "ativo") return { ok: false, error: "Só contratos ativos podem ser renovados." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Serviço indisponível." };

  const { data: imovel } = await admin
    .from("properties")
    .select("owner_id")
    .eq("id", contrato.property_id)
    .maybeSingle();
  const papel: "proprietario" | "inquilino" | null =
    imovel?.owner_id === user.id ? "proprietario" : contrato.tenant_id === user.id ? "inquilino" : null;
  if (!papel) return { ok: false, error: "Só as partes do contrato podem renovar." };
  const colunaAceite = papel === "proprietario" ? "aceite_proprietario_em" : "aceite_inquilino_em";
  const colunaOutra = papel === "proprietario" ? "aceite_inquilino_em" : "aceite_proprietario_em";

  if (!(await dentroDoLimite(`renovar:${contratoId}:${user.id}`, 3, DIA_SEGUNDOS))) {
    return { ok: false, error: "Muitos pedidos de renovação hoje. Tente amanhã." };
  }

  const { data: blocos } = await admin
    .from("contrato_blocos")
    .select("id, numero_bloco, inicio, fim, caucao, status, aceite_proprietario_em, aceite_inquilino_em")
    .eq("contrato_id", contratoId)
    .order("numero_bloco", { ascending: true });
  const lista = (blocos ?? []) as Record<string, unknown>[];
  const validos = lista.filter((b) => b.status !== "nao_aceito");

  let numero: number;
  let inicio: string;
  let fim: string;
  let aguardando: boolean;

  const pendente = validos.find((b) => b.status === "pendente_aceite");
  if (pendente) {
    // Aceite desta parte num bloco já proposto.
    const outraJaAceitou = !!pendente[colunaOutra];
    const { error } = await admin
      .from("contrato_blocos")
      .update({
        [colunaAceite]: (pendente[colunaAceite] as string | null) ?? new Date().toISOString(),
        ...(outraJaAceitou ? { status: "agendado" } : {}),
      })
      .eq("id", pendente.id as string)
      .eq("status", "pendente_aceite");
    if (error) return { ok: false, error: "Não foi possível registrar o aceite." };
    numero = pendente.numero_bloco as number;
    inicio = pendente.inicio as string;
    fim = pendente.fim as string;
    aguardando = !outraJaAceitou;
  } else {
    // Proposta de um novo bloco (com o aceite de quem propõe).
    const meses = Math.min(MAX_MESES_BLOCO, Math.max(1, Number(contrato.tamanho_bloco_meses) || MESES_POR_BLOCO_PADRAO));
    const diasContratados = validos.reduce(
      (soma, b) => soma + diasInclusivos(b.inicio as string, b.fim as string),
      0
    );
    if (!cabeNoPrazoMaximo(diasContratados, meses)) {
      return {
        ok: false,
        error: `O contrato chegou ao prazo máximo de ${PRAZO_MAX_DIAS} dias. Para continuar, é preciso um novo contrato.`,
      };
    }
    const aluguel = Number(contrato.aluguel_mensal) || 0;
    const valor = aluguel * meses;
    const caucaoExigida = validos.reduce((soma, b) => soma + (Number(b.caucao) || 0), 0);
    const ultimo = validos[validos.length - 1];
    inicio = ultimo ? addDiasISO(ultimo.fim as string, 1) : hojeISO();
    fim = fimInclusivoISO(inicio, meses * DIAS_POR_MES);
    numero = ((lista[lista.length - 1]?.numero_bloco as number | undefined) ?? 0) + 1;
    const { error: bErr } = await admin.from("contrato_blocos").insert({
      contrato_id: contratoId,
      numero_bloco: numero,
      inicio,
      fim,
      meses,
      valor,
      caucao: caucaoDoBloco(valor, aluguel, caucaoExigida),
      status: "pendente_aceite",
      [colunaAceite]: new Date().toISOString(),
    });
    if (bErr) return { ok: false, error: "Não foi possível propor a renovação." };
    aguardando = true;
  }

  // Avisa a OUTRA parte (best-effort): precisa do aceite dela, ou a renovação
  // foi confirmada pelos dois.
  try {
    let destino: { email?: string | null; full_name?: string | null } | null = null;
    if (papel === "inquilino") {
      const { data: rpc } = await admin.rpc("owner_notify_contact", { prop_id: contrato.property_id });
      destino = (Array.isArray(rpc) ? rpc[0] : rpc) ?? null;
    } else {
      const { data: inq } = await admin
        .from("profiles")
        .select("email, full_name, notif_email")
        .eq("id", contrato.tenant_id as string)
        .maybeSingle();
      destino = inq && inq.notif_email !== false ? inq : null;
    }
    if (destino?.email) {
      const quem = papel === "inquilino" ? "O inquilino" : "O proprietário";
      await notify({
        event: "contract_status",
        email: destino.email,
        name: destino.full_name ?? undefined,
        pushUrl: "/dashboard/contratos",
        detailsText: aguardando
          ? `${quem} quer renovar a locação: bloco ${numero} (${dataBR(inicio)} a ${dataBR(fim)}). A renovação só vale com o seu aceite — abra Contratos no painel.`
          : `Renovação confirmada pelas duas partes: bloco ${numero} (${dataBR(inicio)} a ${dataBR(fim)}).`,
      });
    }
  } catch {
    /* notificação é best-effort */
  }

  return { ok: true, numeroBloco: numero, aguardandoOutraParte: aguardando };
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado." };
  // A rotina saiu da API (0070): roda pelo servidor.
  const admin = createAdminClient();
  if (!admin) return { ok: true };
  const { error } = await admin.rpc("avancar_ciclo_blocos");
  if (error) return { ok: false, error: erroBancoPT(error) };
  return { ok: true };
}

/** Data de hoje em ISO (yyyy-mm-dd) — isolada para manter as regras testáveis. */
function hojeISO(): string {
  return hojeBR();
}

/**
 * Registra o interesse de um inquilino (dúvida, visita ou candidatura) e AVISA
 * o proprietário por e-mail/WhatsApp — o canal real do funil.
 *
 * O dono é o owner_id da linha do imóvel; grava o lead + abre a conversa.
 * Anúncio de EXEMPLO (id não-uuid) é recusado (`exemplo`): não tem dono e nada
 * é enviado a ninguém (T9). Retorna `needsAuth` se o visitante não estiver
 * logado e `selfOwned` se for o próprio dono abrindo o anúncio.
 */
// Anti-flood: teto de contatos que um inquilino dispara por hora (mesmo espírito
// do IA_LIMITE_DIA). 20 cobre o uso legítimo — o inquilino interessado contata
// vários imóveis — e corta scripts de spam de notificação ao proprietário.
const LEAD_LIMITE_HORA = 20;

export async function requestLead(
  propertyId: string,
  // Ignorado: o título vem do BANCO. O que o navegador manda não entra no
  // e-mail oficial (dava para enviar um título com link de golpe).
  _tituloDoCliente: string,
  kind: LeadKind,
  note?: string
): Promise<ActionResult & { needsAuth?: boolean; selfOwned?: boolean; exemplo?: boolean }> {
  // T9: anúncio de EXEMPLO não tem dono — nada de candidatura, contato nem e-mail
  // (antes ia o nome do inquilino para um e-mail pessoal de fallback).
  if (isExemplo(propertyId)) return { ok: false, exemplo: true, error: EXEMPLO_SEM_CONTATO };

  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, needsAuth: true, error: "Entre para falar com o proprietário." };

  // Dono do imóvel: owner_id da linha; contato só pela RPC (service role).
  let ownerId: string | null = null;
  let ownerEmail: string | null = null;
  let ownerPhone: string | null = null;
  let ownerName: string | null = null;
  let propertyTitle = "seu imóvel";
  {
    const { data: prop } = await supabase
      .from("properties")
      .select("owner_id, title")
      .eq("id", propertyId)
      .maybeSingle();
    ownerId = (prop?.owner_id as string | undefined) ?? null;
    propertyTitle = ((prop?.title as string | undefined) ?? "").trim() || propertyTitle;
    if (ownerId) {
      // A RLS de `profiles` ("perfil próprio") bloqueia a sessão do inquilino de
      // ler o contato do dono. A RPC SECURITY DEFINER `owner_notify_contact`
      // (migração 0023) devolve o contato do dono de um anúncio ATIVO só para a
      // notificação. Enquanto a migração não roda, o erro cai no fallback abaixo.
      // C3: RPC de contato (PII) só via service role no servidor (não mais pela sessão).
      const admin = createAdminClient();
      const { data: rpc } = admin
        ? await admin.rpc("owner_notify_contact", { prop_id: propertyId })
        : { data: null };
      const o = Array.isArray(rpc) ? rpc[0] : rpc;
      ownerEmail = o?.email ?? null;
      ownerPhone = o?.phone ?? null;
      ownerName = o?.full_name ?? null;
    }
  }
  if (!ownerId) return { ok: false, error: "Imóvel não encontrado ou indisponível." };
  // T9: sem e-mail do dono (RPC falhou/sem service role) NÃO há desvio para outro
  // endereço — o aviso segue por push (userId) e fica o registro no log.
  if (!ownerEmail) console.warn("[requestLead] sem e-mail do proprietário; aviso só por push", propertyId);

  // O próprio dono abrindo seu anúncio: não gera lead para si mesmo.
  if (ownerId && ownerId === user.id) return { ok: true, selfOwned: true };

  // Identidade do interessado (perfil próprio — permitido pela RLS).
  // Só o nome: o aviso ao dono mostra o PRIMEIRO nome (contato nunca sai).
  const { data: me } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const tenantName = me?.full_name ?? "Interessado";

  // Anti-flood: conta os leads REAIS do inquilino na última hora. Protege o
  // proprietário de spam de notificação e o custo de e-mail/WhatsApp. Cliques
  // repetidos no MESMO imóvel já são deduplicados abaixo (não contam), então o
  // teto mira a largura — muitos imóveis distintos em pouco tempo.
  {
    const desdeUmaHora = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", user.id)
      .gte("created_at", desdeUmaHora);
    if ((count ?? 0) >= LEAD_LIMITE_HORA) {
      return {
        ok: false,
        error: "Você atingiu o limite de contatos por hora. Tente novamente em instantes.",
      };
    }
  }

  // Contato novo? Só notifica o dono quando há de fato um lead novo — clique
  // repetido no mesmo imóvel não re-notifica. Exceção: candidatura sempre
  // notifica (evento de maior valor no piloto); o teto de 20/h barra a
  // repetição. Distinguir "1ª candidatura" de "candidatura repetida" exigiria
  // registrar o kind no lead (migração) — hoje o lead é único por (imóvel,
  // inquilino) e o status 'new' não codifica o kind.
  let novoContato = true;

  // Imóvel real: grava lead + abre conversa. Dedup por (imóvel, interessado)
  // para que cliques repetidos não criem leads/mensagens duplicados.
  {
    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .eq("property_id", propertyId)
      .eq("tenant_id", user.id)
      .maybeSingle();
    novoContato = !existing;
    if (!existing) {
      const { error: leadErr } = await supabase
        .from("leads")
        .insert({ property_id: propertyId, owner_id: ownerId, tenant_id: user.id, status: "new" });
      // 23505 = duplicado (corrida): não é erro real. Demais erros: registra.
      if (leadErr && leadErr.code !== "23505") {
        console.error("[requestLead] falha ao gravar lead:", leadErr.message);
      }
      const conversationId = idConversa(user.id, ownerId, propertyId);
      // Mensagem do inquilino: usa o texto que ele escreveu (dúvida/horários),
      // com contato mascarado (regra de ouro — nada de telefone/e-mail no chat
      // antes do aceite); sem texto, cai na mensagem padrão da ação.
      const corpo = note && note.trim()
        ? guardContactInfo(note.trim().slice(0, 1000)).text
        : LEAD_KIND_MSG[kind](propertyTitle);
      const { error: msgErr } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        receiver_id: ownerId,
        property_id: propertyId,
        body: corpo,
      });
      if (msgErr) {
        console.error("[requestLead] falha ao abrir conversa:", msgErr.code, msgErr.message);
      }
    }
  }

  // Notifica o dono só em contato NOVO — ou sempre que for candidatura (evento
  // de maior valor; o teto de 20/h barra repetição). É isto que faz os botões
  // funcionarem de verdade: o lead chega ao e-mail/WhatsApp do proprietário.
  if (novoContato || kind === "candidatura") {
    const { detailsHtml, detailsText } = buildLeadNotification(kind, propertyTitle, {
      name: tenantName,
    });
    await notify({
      event: "new_lead",
      email: ownerEmail ?? undefined,
      phone: ownerPhone ?? undefined,
      name: ownerName ?? undefined,
      userId: ownerId ?? undefined,
      pushUrl: "/dashboard/leads",
      detailsHtml,
      detailsText,
    });
  }

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

  // Id SEMPRE recalculado no servidor (as duas pessoas + imóvel): o valor que
  // vem do cliente é ignorado, para não dar para "entrar" em outra conversa.
  const conversationId = idConversa(user.id, input.receiverId, input.propertyId);

  // Proteção de contato: telefones/e-mails/links de mensageria são mascarados
  // ANTES de gravar — a negociação fica registrada na plataforma e o contato
  // direto só é liberado no fluxo oficial (após o aceite do proprietário).
  const { text: safeBody } = guardContactInfo(input.body);

  const { data: gravada, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      receiver_id: input.receiverId,
      property_id: input.propertyId ?? null,
      body: safeBody,
    })
    .select("receiver_id")
    .single();
  if (error || !gravada) {
    console.error("[sendMessage] falha ao gravar:", error?.code, error?.message);
    return { ok: false, error: "Não foi possível enviar a mensagem agora. Tente de novo em instantes." };
  }
  // Destinatário pela LINHA GRAVADA (que passou na RLS), não pelo parâmetro.
  const destinatarioId = gravada.receiver_id as string;

  // Notifica o destinatário por e-mail com o LINK para responder NO SITE
  // (nunca por e-mail — mantém o registro). Best-effort: falha de notificação
  // não derruba o envio. O contato vem da RPC escopada (migração 0024); sem a
  // migração, segue sem notificar.
  try {
    // C3: contato (PII) só no servidor, via service role. A relação entre as
    // partes já foi provada: o INSERT acima passou na RLS de messages (exige
    // lead ou resposta a pedido). A RPC antiga dependia de auth.uid(), que é
    // nulo com service role — por isso a leitura direta, escopada ao destinatário.
    const admin = createAdminClient();
    const { data: contact } = admin
      ? await admin
          .from("profiles")
          .select("full_name, email, phone")
          .eq("id", destinatarioId)
          .maybeSingle()
      : { data: null };
    // Anti-spam de e-mail: no máximo 1 e-mail por conversa a cada 30 min (o
    // resto da rajada fica só no site) e 30 e-mails/hora disparados por quem
    // escreve. A mensagem em si SEMPRE é gravada — só o e-mail é contido.
    const podeAvisar =
      !!contact?.email &&
      (await dentroDoLimite(`msg-email:${conversationId}:${destinatarioId}`, 1, 30 * 60)) &&
      (await dentroDoLimite(`msg-email-remetente:${user.id}`, 30, HORA));
    if (contact?.email && podeAvisar) {
      const { data: me } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      // Identidade pós-aceite: só o PRIMEIRO nome no e-mail (nunca o sobrenome).
      const senderName = (me?.full_name ?? "").trim().split(/\s+/)[0] || "Um usuário";
      // Nome e prévia são texto do USUÁRIO: sem HTML ativo e sem links no e-mail.
      const nomeHtml = textoEmail(senderName, 40);
      const previewHtml = textoEmail(safeBody, 140);
      const previewTexto = textoPlano(safeBody, 140);
      const link = `${SITE_URL}/dashboard/mensagens`;
      await notify({
        event: "new_message",
        email: contact.email,
        name: contact.full_name ?? undefined,
        detailsHtml:
          `<p><strong>${nomeHtml}</strong> escreveu:</p>` +
          `<blockquote style="margin:8px 0;padding:8px 12px;border-left:3px solid #1c6b3a;color:#374151">${previewHtml}</blockquote>` +
          `<p><a href="${link}" style="display:inline-block;background:#1c6b3a;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:600">Responder no Viva Nomads</a></p>` +
          `<p style="color:#6b7280;font-size:12px">Responda sempre pela plataforma — assim a conversa fica registrada e protegida. Não responda este e-mail.</p>`,
        detailsText: `${textoPlano(senderName, 40)}: ${previewTexto}\n\nResponda pela plataforma (a conversa fica registrada): ${link}`,
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
  if (error) return { ok: false, error: erroBancoPT(error) };
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
    if (error) return { ok: false, error: erroBancoPT(error) };
    await sincronizarFotos(supabase, snap.id, user.id, urlsDoRascunho(snap.data));
    return { ok: true, id: snap.id };
  }
  const { data, error } = await supabase.from("properties").insert(fields).select("id").single();
  if (error) return { ok: false, error: erroBancoPT(error) };
  await sincronizarFotos(supabase, data.id as string, user.id, urlsDoRascunho(snap.data));
  return { ok: true, id: data.id };
}

/**
 * Mensagem de bloqueio se publicar mais um anúncio estoura o limite de anúncios
 * ATIVOS do plano efetivo (assinatura ou Fundador); null se pode. `exceto` = o
 * próprio imóvel sendo (re)publicado (já ativo não conta duas vezes).
 */
async function limiteDePublicacao(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  ownerId: string,
  exceto: string | null
): Promise<string | null> {
  const plan = (await planoDoProprietario(supabase, ownerId)) as SubscriptionPlan;
  let q = supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .eq("status", "active");
  if (exceto) q = q.neq("id", exceto);
  const { count } = await q;
  if ((count ?? 0) >= listingLimit(plan)) {
    return `Seu plano (${PLAN_LABEL[plan]}) permite até ${listingLimit(plan)} anúncio(s) publicado(s). Pause um anúncio ou faça upgrade para publicar mais.`;
  }
  return null;
}

/**
 * Grava as fotos do anúncio em `property_photos` (a 1ª é a capa) — é daí que
 * saem a contagem do "Meus imóveis", o photo_count e a trava de 8 fotos para
 * publicar. Só regrava quando a lista mudou (o autosave roda a cada edição).
 * Só fotos do bucket na pasta do dono. Best-effort: falha não derruba o salvar.
 */
async function sincronizarFotos(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  propertyId: string,
  ownerId: string,
  urls: readonly unknown[]
): Promise<void> {
  const novas = fotosDoDono(urls, ownerId);
  try {
    const { data: atuais } = await supabase
      .from("property_photos")
      .select("url")
      .eq("property_id", propertyId)
      .order("sort_order");
    const iguais =
      (atuais ?? []).length === novas.length && (atuais ?? []).every((r, i) => r.url === novas[i]);
    if (iguais) return;
    await supabase.from("property_photos").delete().eq("property_id", propertyId);
    if (novas.length > 0) {
      const { error } = await supabase
        .from("property_photos")
        .insert(novas.map((url, i) => ({ property_id: propertyId, url, sort_order: i })));
      if (error) console.error("[sincronizarFotos] falha ao gravar fotos:", error.message);
    }
  } catch (e) {
    console.error("[sincronizarFotos] erro:", e);
  }
}

/** Carrega o estado salvo (draft_data) de um rascunho do dono, para retomar. */
export async function loadDraftData(id: string): Promise<unknown | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  // C4: draft_data saiu do SELECT por coluna; o dono lê pela RPC (checa owner).
  const { data } = await supabase.rpc("property_private_details", { prop_id: id });
  const row = Array.isArray(data) ? data[0] : data;
  return (row as { draft_data?: unknown } | null)?.draft_data ?? null;
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
    .select("id, title")
    .eq("owner_id", user.id)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  // C4: draft_data vem pela RPC (coluna sensível fora do SELECT por coluna).
  const { data: priv } = await supabase.rpc("property_private_details", { prop_id: data.id });
  const row = Array.isArray(priv) ? priv[0] : priv;
  return {
    id: data.id as string,
    title: (data.title as string) || "Rascunho de anúncio",
    data: (row as { draft_data?: unknown } | null)?.draft_data ?? null,
  };
}
