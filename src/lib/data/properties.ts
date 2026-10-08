import { createClient } from "@/lib/supabase/server";
import { isExemplo } from "@/lib/demo-listing";
import { createPublicClient } from "@/lib/supabase/public";
import type { Property, AmenityGroup } from "@/lib/types";
import { SAMPLE_PROPERTIES } from "@/lib/properties";
import { signAvatarPath } from "@/lib/data/avatar-url";

/**
 * Colunas SEGURAS de `properties` para leitura (público e dono). NUNCA inclui
 * exact_address, responsavel_local_*, draft_data ou sublease_doc_url — essas são
 * privadas (RPC property_private_details). DEVE espelhar o grant por coluna da
 * migração 0053; ao adicionar coluna nova em properties, inclua aqui E no grant
 * (o `npm run check:migracoes` avisa se divergir). Trocar `select("*")` por esta
 * lista é o que impede o PostgREST anônimo de puxar coluna sensível.
 */
export const PROPERTY_PUBLIC_COLUMNS =
  "id, owner_id, title, description, property_type, city, state, address, " +
  "lat, lng, bedrooms, bathrooms, area_m2, min_period_days, monthly_price, " +
  "utilities_mode, utilities_estimate, utilities_overage_margin, prep_fee, " +
  "checkout_cleaning_enabled, checkout_cleaning_fee, issues_invoice, " +
  "accepts_insurance, rating, review_count, status, ready_to_live_badge, " +
  "ready_to_live_score, tag_home_office, tag_work_located, tag_condo_approved, " +
  "ownership_type, sublease_authorized, video_url, created_at, faixas_aceitas, " +
  "garantias_aceitas, google_places, parking_spots, condo_fee, " +
  "descricao_gerada_por_ia, available_from, furnished, pets_allowed, " +
  "smoking_allowed, children_allowed, max_guests, available_until, " +
  "max_period_days, checkin_after, checkout_before";

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
  faixas_aceitas: string[] | null;
  garantias_aceitas: string[] | null;
  google_places: { place_id: string; categoria: string; rotulo?: string }[] | null;
  // Enriquecimento (migração 0018 — podem não existir se a migração não rodou).
  parking_spots: number | null;
  condo_fee: number | null;
  descricao_gerada_por_ia: boolean | null;
  available_from: string | null;
  furnished: boolean | null;
  pets_allowed: boolean | null;
  smoking_allowed: boolean | null;
  children_allowed: boolean | null;
  max_guests: number | null;
  available_until: string | null;
  max_period_days: number | null;
  checkin_after: string | null;
  checkout_before: string | null;
}

/*
  Anúncios demonstração (os 3 imóveis de Uberlândia, com fotos próprias) ficam
  visíveis junto dos imóveis reais enquanto o catálogo real ainda está pequeno —
  assim a busca/home nunca aparecem vazias. Para esconder os demos quando houver
  catálogo real suficiente, defina NEXT_PUBLIC_SHOW_DEMO_PROPERTIES=false na Vercel.
*/
function showDemoProperties(): boolean {
  return process.env.NEXT_PUBLIC_SHOW_DEMO_PROPERTIES !== "false";
}

/** Acrescenta os anúncios demo aos reais (sem duplicar por id), quando habilitado. */
function withDemos(real: Property[]): Property[] {
  if (!showDemoProperties()) return real;
  const realIds = new Set(real.map((p) => p.id));
  return [...real, ...SAMPLE_PROPERTIES.filter((p) => !realIds.has(p.id))];
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
    // Enriquecimento (escalares; relações são carregadas por enrichProperty).
    parkingSpots: row.parking_spots ?? undefined,
    condoFee: row.condo_fee != null ? Number(row.condo_fee) : undefined,
    descricaoGeradaPorIa: row.descricao_gerada_por_ia === true,
    availableFrom: row.available_from ?? undefined,
    furnished: row.furnished ?? undefined,
    petsAllowed: row.pets_allowed ?? undefined,
    smokingAllowed: row.smoking_allowed ?? undefined,
    childrenAllowed: row.children_allowed ?? undefined,
    maxGuests: row.max_guests ?? undefined,
    availableUntil: row.available_until ?? undefined,
    maxPeriodDays: row.max_period_days ?? undefined,
    checkinAfter: row.checkin_after ?? undefined,
    checkoutBefore: row.checkout_before ?? undefined,
    faixasAceitas: row.faixas_aceitas ?? undefined,
    garantiasAceitas: row.garantias_aceitas ?? undefined,
    googlePlaces: row.google_places
      ? row.google_places.map((g) => ({ placeId: g.place_id, categoria: g.categoria, rotulo: g.rotulo }))
      : undefined,
  };
}

type SupabaseLike = NonNullable<Awaited<ReturnType<typeof createPublicClient>>>;

/**
 * Carrega as relações de um imóvel REAL (fotos, comodidades, espaços, proximidades,
 * avaliações, perfil do dono) de forma best-effort: se uma tabela ainda não existe
 * (migração 0018 não rodou) ou a consulta falha, aquela seção simplesmente fica
 * vazia — a UI a esconde. Nunca lança nem quebra a página.
 */
async function enrichProperty(supabase: SupabaseLike, base: Property, ownerId: string | null): Promise<Property> {
  const safe = async <T>(p: PromiseLike<{ data: T | null }>): Promise<T | null> => {
    try {
      const { data } = await p;
      return data ?? null;
    } catch {
      return null;
    }
  };

  const [photos, amenities, workspaces, proximities, reviews, owner] = await Promise.all([
    safe(supabase.from("property_photos").select("url, sort_order").eq("property_id", base.id).order("sort_order")),
    safe(supabase.from("property_amenities").select("category, label, sort_order").eq("property_id", base.id).order("sort_order")),
    safe(supabase.from("property_workspaces").select("name, type, distance_m").eq("property_id", base.id)),
    safe(supabase.from("property_proximities").select("category, name, note, sort_order").eq("property_id", base.id).order("sort_order")),
    safe(supabase.from("avaliacoes").select("nota_geral, comentario_publico, publicada_em").eq("imovel_id", base.id).eq("papel_autor", "inquilino").eq("status", "publicada").order("publicada_em", { ascending: false })),
    ownerId ? safe(supabase.from("profiles").select("full_name, avatar_url, created_at, response_rate, is_verified").eq("id", ownerId).maybeSingle()) : Promise.resolve(null),
  ]);

  // Comodidades agrupadas por categoria (na ordem de cadastro).
  const groupsMap = new Map<string, string[]>();
  for (const a of (amenities as { category: string; label: string }[] | null) ?? []) {
    if (!groupsMap.has(a.category)) groupsMap.set(a.category, []);
    groupsMap.get(a.category)!.push(a.label);
  }
  const amenityGroups: AmenityGroup[] = [...groupsMap.entries()].map(([category, items]) => ({
    category: category as AmenityGroup["category"],
    items,
  }));

  const ownerRow = owner as { full_name: string | null; avatar_url: string | null; created_at: string | null; response_rate: number | null; is_verified: boolean | null } | null;

  // Foto do proprietário é PÚBLICA (podeVerAvatar owner = true). O bucket é
  // privado, então assinamos o caminho no servidor (admin) — null vira iniciais.
  const ownerAvatarUrl = await signAvatarPath(ownerRow?.avatar_url ?? null, ownerId);

  return {
    ...base,
    photos: ((photos as { url: string }[] | null) ?? []).map((p) => p.url),
    amenities: ((amenities as { label: string }[] | null) ?? []).map((a) => a.label),
    amenityGroups: amenityGroups.length > 0 ? amenityGroups : undefined,
    nearbyWorkspaces: ((workspaces as { name: string; type: string; distance_m: number | null }[] | null) ?? []).map((w) => ({
      name: w.name,
      type: w.type as Property["nearbyWorkspaces"][number]["type"],
      distanceM: w.distance_m ?? 0,
    })),
    proximities: ((proximities as { category: string; name: string; note: string | null }[] | null) ?? []).map((p) => ({
      category: p.category as NonNullable<Property["proximities"]>[number]["category"],
      name: p.name,
      note: p.note ?? undefined,
    })),
    // Avaliação real de quem morou (0089): sem nome digitado — "Inquilino verificado".
    reviews: ((reviews as { nota_geral: number; comentario_publico: string | null; publicada_em: string | null }[] | null) ?? []).map((r) => ({
      author: "Inquilino verificado",
      rating: Number(r.nota_geral),
      comment: r.comentario_publico ?? "",
      date: r.publicada_em ?? undefined,
    })),
    ownerName: ownerRow?.full_name ?? base.ownerName,
    ownerId: ownerId ?? base.ownerId,
    owner: ownerRow
      ? {
          name: ownerRow.full_name ?? "Proprietário",
          avatarUrl: ownerAvatarUrl ?? undefined,
          memberSince: ownerRow.created_at ?? undefined,
          responseRate: ownerRow.response_rate ?? undefined,
          verified: ownerRow.is_verified ?? undefined,
        }
      : undefined,
  };
}

export async function listProperties(): Promise<Property[]> {
  const supabase = createPublicClient();
  // Modo demonstração (sem Supabase): dados de exemplo.
  if (!supabase) return SAMPLE_PROPERTIES;

  try {
    const { data, error } = await supabase
      .from("properties")
      .select(PROPERTY_PUBLIC_COLUMNS)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    // Diagnóstico (FASE 0): a chave anon NÃO lança quando a RLS bloqueia — ela
    // devolve data=[] e error=null. Logamos o error para distinguir "0 imóveis"
    // (banco vazio, normal) de "erro ao buscar" (RLS/coluna/permissão).
    if (error) console.error("[listProperties] Supabase error:", error.code, error.message);
    // Imóveis reais + anúncios demo (enquanto o flag estiver ligado), sem 500.
    if (error || !data) return withDemos([]);
    const mapped = (data as unknown as PropertyRow[]).map(rowToProperty);
    await attachCoverPhotos(supabase, mapped); // capa real para os cards (best-effort)
    await attachReviewAggregates(supabase, mapped); // nota/contagem REAL (fonte única)
    return withDemos(mapped);
  } catch (e) {
    // Falha de rede/consulta → só os demos (ou vazio, se desligados), nunca 500.
    console.error("[listProperties] consulta falhou:", e instanceof Error ? e.message : e);
    return withDemos([]);
  }
}

export async function getProperty(id: string): Promise<Property | undefined> {
  const supabase = createPublicClient();
  // Modo demonstração (sem Supabase): dados de exemplo.
  if (!supabase) return SAMPLE_PROPERTIES.find((p) => p.id === id);
  // Anúncio de exemplo (id não-uuid, ex.: "ube-001"): nem consulta o banco —
  // a coluna é uuid e a consulta só voltava 400.
  if (isExemplo(id)) return showDemoProperties() ? SAMPLE_PROPERTIES.find((p) => p.id === id) : undefined;

  try {
    // `maybeSingle` devolve null (sem erro) para zero linhas — evita o PGRST116
    // do `.single()` virar 500. Só imóveis ATIVOS são públicos: rascunho/pausado
    // por URL direta → 404 (não vaza). id mal formado cai no catch → 404.
    const { data, error } = await supabase
      .from("properties")
      .select(PROPERTY_PUBLIC_COLUMNS)
      .eq("id", id)
      .eq("status", "active")
      .maybeSingle();
    if (error) console.error("[getProperty] Supabase error:", error.code, error.message);
    // Sem linha no banco: cai para o anúncio demo de mesmo id (se habilitado).
    if (!data) return showDemoProperties() ? SAMPLE_PROPERTIES.find((p) => p.id === id) : undefined;
    const base = rowToProperty(data as unknown as PropertyRow);
    return enrichProperty(supabase, base, (data as { owner_id?: string }).owner_id ?? null);
  } catch {
    return showDemoProperties() ? SAMPLE_PROPERTIES.find((p) => p.id === id) : undefined;
  }
}

/**
 * Carrega um imóvel do PRÓPRIO dono para edição — qualquer status (inclusive
 * rascunho/pausado), com o cliente autenticado (a RLS garante que só o dono lê o
 * dele). Em modo demonstração, cai no imóvel de exemplo de mesmo id.
 */
export async function getPropertyForOwner(id: string): Promise<Property | undefined> {
  const supabase = await createClient();
  if (!supabase) return SAMPLE_PROPERTIES.find((p) => p.id === id);
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return undefined;
    if (isExemplo(id)) return SAMPLE_PROPERTIES.find((p) => p.id === id);
    const { data } = await supabase
      .from("properties")
      .select(PROPERTY_PUBLIC_COLUMNS)
      .eq("id", id)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!data) return SAMPLE_PROPERTIES.find((p) => p.id === id);
    const base = rowToProperty(data as unknown as PropertyRow);
    // 0091: só o "tem documento" (nunca o caminho). Sem a migração, fica indefinido.
    const { data: aut } = await supabase.from("properties").select("autorizacao_anexada").eq("id", id).eq("owner_id", user.id).maybeSingle();
    if (aut && typeof (aut as { autorizacao_anexada?: unknown }).autorizacao_anexada === "boolean")
      base.autorizacaoAnexada = (aut as { autorizacao_anexada: boolean }).autorizacao_anexada;
    return enrichProperty(supabase, base, user.id);
  } catch {
    return undefined;
  }
}

/** Anexa as fotos (capa) aos imóveis reais para os cards da busca. Best-effort. */
async function attachCoverPhotos(supabase: SupabaseLike, list: Property[]): Promise<void> {
  if (list.length === 0) return;
  try {
    const ids = list.map((p) => p.id);
    const { data } = await supabase
      .from("property_photos")
      .select("property_id, url, sort_order")
      .in("property_id", ids)
      .order("sort_order");
    const byProp = new Map<string, string[]>();
    for (const row of ((data as { property_id: string; url: string }[] | null) ?? [])) {
      if (!byProp.has(row.property_id)) byProp.set(row.property_id, []);
      byProp.get(row.property_id)!.push(row.url);
    }
    for (const p of list) {
      const urls = byProp.get(p.id);
      if (urls && urls.length > 0) p.photos = urls;
    }
  } catch {
    /* tabela ausente / falha → mantém sem fotos */
  }
}

/**
 * Sincroniza `rating`/`reviewCount` dos cards a partir das avaliações REAIS
 * (`avaliacoes` publicadas pelo inquilino, 0089) — a MESMA fonte da página de detalhe e do JSON-LD. Assim o
 * card nunca mostra uma contagem diferente da que o usuário vê no anúncio.
 * Best-effort: tabela ausente/consulta falha → mantém os escalares como vieram.
 */
async function attachReviewAggregates(supabase: SupabaseLike, list: Property[]): Promise<void> {
  if (list.length === 0) return;
  try {
    const ids = list.map((p) => p.id);
    const { data } = await supabase
      .from("avaliacoes")
      .select("imovel_id, nota_geral")
      .in("imovel_id", ids)
      .eq("papel_autor", "inquilino")
      .eq("status", "publicada");
    const agg = new Map<string, { soma: number; n: number }>();
    for (const row of ((data as { imovel_id: string; nota_geral: number }[] | null) ?? [])) {
      const cur = agg.get(row.imovel_id) ?? { soma: 0, n: 0 };
      cur.soma += Number(row.nota_geral) || 0;
      cur.n += 1;
      agg.set(row.imovel_id, cur);
    }
    for (const p of list) {
      const a = agg.get(p.id);
      if (a && a.n > 0) {
        p.reviewCount = a.n;
        p.rating = Math.round((a.soma / a.n) * 10) / 10;
      } else {
        // Sem avaliação real → zera (nada de escalar herdado inflando o card).
        p.reviewCount = 0;
        p.rating = 0;
      }
    }
  } catch {
    /* tabela ausente / falha → mantém os escalares */
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
    .select(PROPERTY_PUBLIC_COLUMNS)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  const lista = (data as unknown as PropertyRow[]).map(rowToProperty);
  // As fotos vêm de property_photos (sem isso o card ficava sem capa).
  await attachCoverPhotos(supabase, lista);
  return lista;
}
