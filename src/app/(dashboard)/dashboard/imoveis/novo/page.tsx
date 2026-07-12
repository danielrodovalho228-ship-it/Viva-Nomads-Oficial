"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Lock,
  ClipboardCheck,
  Check,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Home,
  MapPin,
  BedDouble,
  Camera,
  Briefcase,
  Tag,
  CheckCircle2,
  PlayCircle,
  ShieldCheck,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { createProperty, updateProperty, loadPropertyForEdit, getMyDocumentStatus, saveDraftData, loadDraftData, getLatestDraft, type DocumentStatus } from "@/lib/data/actions";
import { draftCompletionPct } from "@/lib/draft-progress";
import { geocodeForSave } from "@/lib/integrations/geocoding";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { Button, ButtonLink } from "@/components/ui/button";
import { DocConferidaBadge } from "@/components/ui/badge";
import { PropertyMiniCard } from "@/components/property-mini-card";
import { PhotoUploader, type PhotoItem } from "@/components/photo-uploader";
import { uploadPropertyDoc, removePropertyDoc } from "@/lib/data/storage";
import { MIN_PHOTOS, SUGGESTED_ROOMS, tierFromPhotoCount, TIER_META } from "@/lib/listing";
import { FAIXAS, GARANTIAS_CADASTRO } from "@/lib/faixas";
import { PROPERTY_TYPES, AMENITY_GROUPS, propertyTypeLabel, amenityKeysFromLabels } from "@/lib/amenities";
import { PlacesPicker, type CuratedPlace } from "@/components/property/places-picker";
import { ManualProximities } from "@/components/property/manual-proximities";
import { LocationDatalist } from "@/lib/locations";
import { GERACAO_IA_ATIVA } from "@/lib/flags";
import { PHOTOS } from "@/lib/media";
import type { Property, Proximity } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Metadados das 7 etapas do wizard (rodada 15). */
const STEP_META = [
  { label: "Tipo", icon: Home, title: "Tipo e operação", subtitle: "Que imóvel é e quem o opera." },
  { label: "Endereço", icon: MapPin, title: "Endereço", subtitle: "Onde fica o imóvel." },
  { label: "Detalhes", icon: BedDouble, title: "Detalhes do imóvel", subtitle: "Cômodos, área e período." },
  { label: "Fotos", icon: Camera, title: "Fotos do imóvel", subtitle: "Mínimo de 8 — anúncio bem fotografado se destaca." },
  { label: "Comodidades", icon: Briefcase, title: "Comodidades", subtitle: "Marque o que o imóvel oferece — por categoria." },
  { label: "Preço", icon: Tag, title: "Descrição e preço", subtitle: "Como o anúncio se apresenta e quanto custa." },
  { label: "Revisão", icon: CheckCircle2, title: "Revisão", subtitle: "Confira tudo antes de publicar." },
] as const;
const LAST = STEP_META.length - 1;

export default function NewPropertyPage() {
  const [approved, setApproved] = useState<boolean | null>(null);
  // Estado da verificação do documento (anti-fraude, item 1). Só "approved"
  // libera Publicar. Em demo/preview vem "approved" (não trava).
  const [docStatus, setDocStatus] = useState<DocumentStatus>("approved");
  const [docReason, setDocReason] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiWarn, setAiWarn] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [propertyType, setPropertyType] = useState("apartamento");
  const [description, setDescription] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [areaM2, setAreaM2] = useState("");
  const [parkingSpots, setParkingSpots] = useState("");
  // Capacidade máxima de pessoas (Onda 1 — valida contra o nº de ocupantes no
  // fechamento). Persistido em `max_guests`.
  const [maxGuests, setMaxGuests] = useState("");
  const [minPeriod, setMinPeriod] = useState("30");
  const [maxPeriod, setMaxPeriod] = useState("180");
  const [availableFrom, setAvailableFrom] = useState("");
  const [availableUntil, setAvailableUntil] = useState("");
  const [furnished, setFurnished] = useState(true);
  const [petsOk, setPetsOk] = useState(false);
  const [smokingAllowed, setSmokingAllowed] = useState(false);
  const [childrenAllowed, setChildrenAllowed] = useState(true);
  // Comodidades selecionadas (chaves do catálogo único).
  const [amenityKeys, setAmenityKeys] = useState<Record<string, boolean>>({});
  // Proximidades reais (Google) — só place_id + categoria + rótulo.
  const [googlePlaces, setGooglePlaces] = useState<CuratedPlace[]>([]);
  // Proximidades manuais (nome + distância digitados) — sem depender do Google.
  const [manualProximities, setManualProximities] = useState<Proximity[]>([]);
  const [monthlyPrice, setMonthlyPrice] = useState("");
  const [street, setStreet] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("Uberlândia");
  const [cep, setCep] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [utilitiesMode, setUtilitiesMode] = useState<"fixed" | "real">("fixed");
  const [utilitiesEstimate, setUtilitiesEstimate] = useState(200);
  const [issuesInvoice, setIssuesInvoice] = useState(false);
  // Faixas de prazo aceitas (temporada / média estadia / longa).
  const [faixas, setFaixas] = useState<Record<string, boolean>>({
    temporada: true,
    media_estadia: true,
    longa: false,
  });
  // Garantias que o proprietário ACEITA (só preferência de aceite — não muda o
  // caminho do dinheiro). Caução à vista por padrão. (Título aposentado — Onda 1.)
  const [garantias, setGarantias] = useState<Record<string, boolean>>({
    caucao_avista: true,
    caucao_parcelada: false,
    seguro_fianca: false,
  });
  const [prepFee, setPrepFee] = useState(450);
  const [ownershipType, setOwnershipType] = useState<"own" | "subleased">("own");
  const [subleaseAuthorized, setSubleaseAuthorized] = useState(false);
  const [subleaseDoc, setSubleaseDoc] = useState<PhotoItem[]>([]);
  const [qual, setQual] = useState({ baseBadge: false, tHome: false, tWork: false });
  // Autosave no SERVIDOR (P0): status honesto + id do rascunho + hora do salvamento.
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedAt, setSavedAt] = useState<string>("");
  const [draftServerId, setDraftServerId] = useState<string | null>(null);
  // "Novo anúncio detecta rascunho": rascunho anterior do dono, oferecido para
  // retomada quando a página abre em branco (sem ?draft/?id). Dispensável.
  const [existingDraft, setExistingDraft] = useState<{ id: string; pct: number } | null>(null);
  const [draftBannerDismissed, setDraftBannerDismissed] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  // Edição: ?id= carrega um imóvel do dono para editar (em vez de criar novo).
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const [editingId, setEditingId] = useState<string | null>(null);
  const router = useRouter();

  const subleaseBlocked = ownershipType === "subleased" && !subleaseAuthorized;
  const photosMissing = Math.max(0, MIN_PHOTOS - photos.length);
  const photoBlocked = photos.length < MIN_PHOTOS;
  const fotosMsg = photosMissing === 1 ? "Falta 1 foto" : `Faltam ${photosMissing} fotos`;

  // Checklist de completude para a Revisão (item 3 do QA): PUBLICAR só libera
  // com tudo verde. A navegação entre etapas continua livre (bom p/ autosave);
  // a trava é só na publicação. Cada item aponta a etapa onde se resolve.
  // Detalhes básicos: um imóvel de verdade tem ao menos 1 banheiro e área > 0
  // (quartos podem ser 0 — studio). Fecha o furo do anúncio "0/0/0" (item 1).
  const detalhesOk = (Number(bathrooms) || 0) >= 1 && (Number(areaM2) || 0) > 0;
  const docAprovado = !!editingId || docStatus === "approved";
  const garantiaOk = Object.values(garantias).some(Boolean);

  const completude = [
    { label: "Endereço preenchido", ok: !!(street.trim() && neighborhood.trim() && city.trim()), step: 1 },
    { label: "Detalhes básicos (quartos, banheiros, área)", ok: detalhesOk, step: 2 },
    { label: "Período mínimo definido", ok: (Number(minPeriod) || 0) > 0, step: 2 },
    { label: `Ao menos ${MIN_PHOTOS} fotos`, ok: photos.length >= MIN_PHOTOS, step: 3 },
    { label: "Título do anúncio", ok: title.trim().length >= 3, step: 5 },
    { label: "Preço mensal maior que zero", ok: Number(monthlyPrice) > 0, step: 5 },
    // O gate humano aparece AQUI (pendente/aprovada). Não vale na edição.
    { label: "Documentação aprovada", ok: docAprovado, step: 0, docItem: true },
  ];
  const completudeOk = completude.every((c) => c.ok);
  const podePublicar = completudeOk && !subleaseBlocked && garantiaOk;

  // Busca o estado da verificação do documento uma vez (portão de Publicar).
  useEffect(() => {
    let alive = true;
    getMyDocumentStatus()
      .then((r) => {
        if (!alive) return;
        setDocStatus(r.status);
        setDocReason(r.reason);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Barra de qualidade do anúncio: fotos + descrição + recursos (rodada 11).
  const quality = Math.min(
    100,
    Math.round((Math.min(photos.length, 20) / 20) * 60) +
      (description.trim().length > 30 ? 20 : 0) +
      (qual.baseBadge ? 20 : 0)
  );

  // Imóvel "ao vivo" para o preview do card (montado conforme preenche).
  const previewProperty = {
    id: "preview",
    title: title.trim() || "Sem título ainda",
    propertyType: propertyTypeLabel(propertyType),
    city: city || "Uberlândia",
    state: "MG",
    neighborhood: neighborhood || "Bairro",
    bedrooms: Number(bedrooms) || 0,
    bathrooms: Number(bathrooms) || 0,
    areaM2: Number(areaM2) || 0,
    monthlyPrice: Number(monthlyPrice) || 0,
    photos: photos.map((p) => p.url),
    readyToLiveBadge: qual.baseBadge,
    tagHomeOffice: qual.tHome,
    tagWorkLocated: qual.tWork,
    tagCondoApproved: false,
  } as Property;

  async function publish(asDraft = false) {
    // Publicar exige documento aprovado (anti-fraude, item 1). Rascunho sempre
    // pode. Não vale na edição de imóvel já existente.
    if (!asDraft && !editingId && docStatus !== "approved") {
      setPublishError(
        docStatus === "rejected"
          ? "Documentação não aprovada — reenvie na qualificação para publicar."
          : "Documentação em análise. Você pode salvar como rascunho; a publicação libera após a aprovação."
      );
      return;
    }
    // Publicação exige tudo verde na checklist de completude (item 3). Rascunho
    // salva mesmo incompleto (o autosave depende disso).
    if (!asDraft) {
      const falta = completude.find((c) => !c.ok);
      if (falta) {
        setPublishError(`Falta concluir: ${falta.label.toLowerCase()}.`);
        setStep(falta.step);
        return;
      }
    }
    if (!asDraft && photoBlocked) {
      setPublishError(`Adicione pelo menos ${MIN_PHOTOS} fotos para publicar. Faltam ${photosMissing}.`);
      return;
    }
    if (subleaseBlocked) {
      setPublishError("Imóvel operado por sublocação exige a confirmação de autorização do proprietário antes de publicar.");
      return;
    }
    // Duração máxima não pode ser menor que a mínima (evita range invertido).
    const minDays = Number(minPeriod) || 30;
    const maxDays = Number(maxPeriod) || 0;
    if (maxDays && maxDays < minDays) {
      setPublishError("A duração máxima não pode ser menor que a mínima. Ajuste os prazos.");
      return;
    }
    setPublishing(true);
    setPublishError(null);
    let q = { score: 0, tHome: false, tWork: false, tCondo: false };
    try {
      const raw = sessionStorage.getItem("vivanomads-qualification");
      if (raw) q = { ...q, ...JSON.parse(raw) };
    } catch {}

    // Geocodifica o endereço para gravar lat/lng — assim o imóvel aparece no
    // mapa e nos filtros por raio. Nunca lança: cai no centro da cidade quando
    // não há coordenada válida (não some do mapa, não vai parar no oceano).
    const coords = await geocodeForSave({ street, neighborhood, city });

    const payload = {
      title: title || "Imóvel mobiliado",
      description,
      propertyType,
      city: city || "Uberlândia",
      neighborhood,
      bedrooms: Number(bedrooms) || 0,
      bathrooms: Number(bathrooms) || 0,
      areaM2: Number(areaM2) || 0,
      minPeriodDays: Number(minPeriod) || 30,
      monthlyPrice: Number(monthlyPrice) || 0,
      readyToLiveScore: q.score,
      tagHomeOffice: q.tHome,
      tagWorkLocated: q.tWork,
      tagCondoApproved: q.tCondo,
      ownershipType,
      subleaseAuthorized,
      // Guarda o PATH do bucket privado (estável); a URL assinada expira. Cai
      // na url só se for preview local (demo/sem migração).
      subleaseDocUrl: subleaseDoc[0]?.path ?? subleaseDoc[0]?.url,
      utilitiesMode,
      utilitiesEstimate,
      issuesInvoice,
      // selo "Aceita Seguro-Fiança" deriva da garantia seguro_fianca.
      acceptsInsurance: !!garantias.seguro_fianca,
      faixasAceitas: Object.keys(faixas).filter((k) => faixas[k]),
      garantiasAceitas: Object.keys(garantias).filter((k) => garantias[k]),
      prepFee,
      // Enriquecimento (FASE 1/2)
      parkingSpots: Number(parkingSpots) || 0,
      maxGuests: Number(maxGuests) || undefined,
      availableFrom: availableFrom || undefined,
      availableUntil: availableUntil || undefined,
      maxPeriodDays: Number(maxPeriod) || undefined,
      furnished,
      petsAllowed: petsOk,
      smokingAllowed,
      childrenAllowed,
      amenityKeys: Object.keys(amenityKeys).filter((k) => amenityKeys[k]),
      googlePlaces,
      proximities: manualProximities,
      lat: coords.lat,
      lng: coords.lng,
      // Só URLs persistentes (Storage). URLs blob: do modo demo morrem ao
      // recarregar — não devem ser gravadas como foto do imóvel.
      photoUrls: photos.map((p) => p.url).filter((u) => u && !u.startsWith("blob:")),
      videoUrl: videoUrl.trim() || undefined,
      // "Salvar rascunho" => draft; "Publicar anúncio" => active (entra na busca).
      asDraft,
    };

    // Edição OU rascunho já persistido no servidor → ATUALIZA a mesma linha
    // (converte o rascunho em ativo ao publicar; nunca cria duplicado). Só cria
    // do zero quando não há id de rascunho ainda.
    const targetId = editingId || draftServerId;
    const res = targetId ? await updateProperty(targetId, payload) : await createProperty(payload);

    setPublishing(false);
    if (!res.ok) {
      setPublishError(res.error ?? "Não foi possível salvar.");
      return;
    }
    // Só limpa o rascunho de "novo anúncio" quando de fato criamos um novo.
    if (!editingId) {
      try {
        localStorage.removeItem("vivanomads-novo-draft");
      } catch {}
    }
    router.push("/dashboard/imoveis");
  }

  // Aplica um snapshot de rascunho (localStorage OU servidor) ao formulário.
  // Fonte única da restauração — usada pela retomada local e pela retomada por
  // `?draft=<id>` (servidor), para nunca divergirem.
  function aplicarDraft(d: Record<string, unknown>) {
    const s = (v: unknown) => (typeof v === "string" ? v : undefined);
    if (s(d.title)) setTitle(d.title as string);
    if (s(d.propertyType)) setPropertyType(d.propertyType as string);
    if (s(d.description)) setDescription(d.description as string);
    if (s(d.bedrooms)) setBedrooms(d.bedrooms as string);
    if (s(d.bathrooms)) setBathrooms(d.bathrooms as string);
    if (s(d.areaM2)) setAreaM2(d.areaM2 as string);
    if (s(d.parkingSpots)) setParkingSpots(d.parkingSpots as string);
    if (s(d.maxGuests)) setMaxGuests(d.maxGuests as string);
    if (s(d.minPeriod)) setMinPeriod(d.minPeriod as string);
    if (s(d.maxPeriod)) setMaxPeriod(d.maxPeriod as string);
    if (s(d.availableFrom)) setAvailableFrom(d.availableFrom as string);
    if (s(d.availableUntil)) setAvailableUntil(d.availableUntil as string);
    if (s(d.monthlyPrice)) setMonthlyPrice(d.monthlyPrice as string);
    if (s(d.street)) setStreet(d.street as string);
    if (s(d.neighborhood)) setNeighborhood(d.neighborhood as string);
    if (s(d.city)) setCity(d.city as string);
    if (s(d.cep)) setCep(d.cep as string);
    if (s(d.videoUrl)) setVideoUrl(d.videoUrl as string);
    if (typeof d.furnished === "boolean") setFurnished(d.furnished);
    if (typeof d.petsOk === "boolean") setPetsOk(d.petsOk);
    if (typeof d.smokingAllowed === "boolean") setSmokingAllowed(d.smokingAllowed);
    if (typeof d.childrenAllowed === "boolean") setChildrenAllowed(d.childrenAllowed);
    if (typeof d.issuesInvoice === "boolean") setIssuesInvoice(d.issuesInvoice);
    if (d.amenityKeys && typeof d.amenityKeys === "object") setAmenityKeys(d.amenityKeys as Record<string, boolean>);
    if (Array.isArray(d.googlePlaces)) setGooglePlaces(d.googlePlaces as CuratedPlace[]);
    if (Array.isArray(d.manualProximities))
      setManualProximities(d.manualProximities as Parameters<typeof setManualProximities>[0]);
    if (d.utilitiesMode === "fixed" || d.utilitiesMode === "real") setUtilitiesMode(d.utilitiesMode);
    if (typeof d.utilitiesEstimate === "number") setUtilitiesEstimate(d.utilitiesEstimate);
    if (d.faixas && typeof d.faixas === "object") setFaixas(d.faixas as Record<string, boolean>);
    if (d.garantias && typeof d.garantias === "object") setGarantias(d.garantias as Record<string, boolean>);
    if (typeof d.prepFee === "number") setPrepFee(d.prepFee);
    if (d.ownershipType === "own" || d.ownershipType === "subleased") setOwnershipType(d.ownershipType);
    if (typeof d.subleaseAuthorized === "boolean") setSubleaseAuthorized(d.subleaseAuthorized);
    if (Array.isArray(d.photos)) setPhotos(d.photos as PhotoItem[]);
    if (Array.isArray(d.subleaseDoc)) setSubleaseDoc(d.subleaseDoc as PhotoItem[]);
    if (d.qual && typeof d.qual === "object") {
      const q = d.qual as Record<string, unknown>;
      setQual({ baseBadge: !!q.baseBadge, tHome: !!q.tHome, tWork: !!q.tWork });
    }
    if (typeof d.step === "number") setStep(Math.min(LAST, Math.max(0, Math.round(d.step))));
  }

  // Retomada por `?draft=<id>` — carrega o snapshot do SERVIDOR e restaura tudo
  // (campos + etapa). É o "Continuar editando" de um rascunho de Meus imóveis.
  const draftParam = searchParams.get("draft");
  useEffect(() => {
    if (!draftParam) return;
    let alive = true;
    (async () => {
      const d = await loadDraftData(draftParam);
      if (!alive) return;
      draftIdRef.current = draftParam;
      setDraftServerId(draftParam);
      setApproved(true);
      if (d && typeof d === "object") aplicarDraft(d as Record<string, unknown>);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftParam]);

  useEffect(() => {
    // Em edição (?id=) ou retomada de rascunho (?draft=), não lê o rascunho local.
    if (editId || draftParam) return;
    const raw = sessionStorage.getItem("vivanomads-qualification");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setApproved(raw ? JSON.parse(raw).eligible === true : false);
    try {
      if (raw) {
        const q = JSON.parse(raw);
        setQual({ baseBadge: !!q.baseBadge, tHome: !!q.tHome, tWork: !!q.tWork });
      }
      const draft = localStorage.getItem("vivanomads-novo-draft");
      if (draft) aplicarDraft(JSON.parse(draft));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, draftParam]);

  // Edição: carrega o imóvel do dono e preenche o formulário. Não requer
  // requalificação (já é um anúncio existente) e não usa o rascunho local.
  useEffect(() => {
    if (!editId) return;
    let alive = true;
    (async () => {
      const p = await loadPropertyForEdit(editId);
      if (!alive) return;
      if (!p) {
        setPublishError("Não foi possível carregar este imóvel para edição. Tente novamente.");
        setApproved(true);
        return;
      }
      setEditingId(editId);
      setApproved(true);
      setTitle(p.title || "");
      setPropertyType(p.propertyType || "apartamento");
      setDescription(p.description || "");
      setBedrooms(p.bedrooms ? String(p.bedrooms) : "");
      setBathrooms(p.bathrooms ? String(p.bathrooms) : "");
      setAreaM2(p.areaM2 ? String(p.areaM2) : "");
      setParkingSpots(p.parkingSpots ? String(p.parkingSpots) : "");
      setMaxGuests(p.maxGuests ? String(p.maxGuests) : "");
      setMinPeriod(String(p.minPeriodDays || 30));
      setMaxPeriod(p.maxPeriodDays ? String(p.maxPeriodDays) : "180");
      setAvailableFrom(p.availableFrom ? p.availableFrom.slice(0, 10) : "");
      setAvailableUntil(p.availableUntil ? p.availableUntil.slice(0, 10) : "");
      setMonthlyPrice(p.monthlyPrice ? String(p.monthlyPrice) : "");
      setNeighborhood(p.neighborhood || "");
      setCity(p.city || "Uberlândia");
      setFurnished(p.furnished ?? true);
      setPetsOk(p.petsAllowed ?? false);
      setSmokingAllowed(p.smokingAllowed ?? false);
      setChildrenAllowed(p.childrenAllowed ?? true);
      setUtilitiesMode(p.utilitiesMode === "real" ? "real" : "fixed");
      setUtilitiesEstimate(p.utilitiesEstimate ?? 200);
      setIssuesInvoice(!!p.issuesInvoice);
      setPrepFee(p.prepFee ?? 450);
      setOwnershipType(p.ownershipType === "subleased" ? "subleased" : "own");
      setSubleaseAuthorized(!!p.subleaseAuthorized);
      setVideoUrl(p.videoUrl || "");
      setAmenityKeys(
        Object.fromEntries(amenityKeysFromLabels(p.amenities || []).map((k) => [k, true]))
      );
      setGooglePlaces((p.googlePlaces || []).map((g) => ({ placeId: g.placeId, categoria: g.categoria, rotulo: g.rotulo })));
      setManualProximities(p.proximities || []);
      if (p.faixasAceitas?.length) setFaixas(Object.fromEntries(p.faixasAceitas.map((k) => [k, true])));
      if (p.garantiasAceitas?.length) setGarantias(Object.fromEntries(p.garantiasAceitas.map((k) => [k, true])));
      setPhotos((p.photos || []).map((url, i) => ({ id: `edit-${i}`, url, name: "", path: null, demo: false })));
    })();
    return () => {
      alive = false;
    };
  }, [editId]);

  // Auto-save do rascunho + indicador "Salvo ✓" (Bloco F).
  // Guarda TODOS os campos serializáveis + a etapa atual, para que trocar de
  // página e voltar não perca nada. Exceção: fotos/documentos (arquivos) não
  // cabem com segurança no armazenamento local — por isso o aviso na tela.
  const draftJson = JSON.stringify({
    title, propertyType, description, bedrooms, bathrooms, areaM2, parkingSpots, maxGuests,
    minPeriod, maxPeriod, availableFrom, availableUntil, monthlyPrice,
    street, neighborhood, city, cep, videoUrl,
    furnished, petsOk, smokingAllowed, childrenAllowed, issuesInvoice,
    amenityKeys, googlePlaces, manualProximities,
    utilitiesMode, utilitiesEstimate, faixas, garantias, prepFee,
    ownershipType, subleaseAuthorized, step,
    // Qualificação (selo + etiquetas). Guardada no rascunho para a retomada por
    // `?draft` (que não passa pela sessionStorage) nunca zerar o 6/6 do selo.
    qual,
    // Fotos/documentos só são guardados quando já têm URL persistente
    // (Supabase Storage). URLs "blob:" do modo demo morrem ao recarregar,
    // então ficam de fora para não restaurar imagens quebradas.
    photos: photos.filter((p) => p.url && !p.url.startsWith("blob:")),
    subleaseDoc: subleaseDoc.filter((p) => p.url && !p.url.startsWith("blob:")),
  });
  // Autosave REAL no servidor (P0). draftIdRef guarda o id de forma síncrona (o
  // 1º save insere e fixa o id; os seguintes ATUALIZAM — sem rascunhos
  // duplicados). localStorage segue como cinto secundário.
  const draftIdRef = useRef<string | null>(null);
  useEffect(() => {
    // Não autossalva em modo edição (?id — imóvel existente, não é rascunho novo).
    if (approved !== true || editId) return;
    try {
      localStorage.setItem("vivanomads-novo-draft", draftJson);
    } catch {
      /* cota do navegador cheia — o rascunho ainda tenta o servidor */
    }
    // Não cria rascunho vazio (evita lixo ao só abrir a página).
    const vazio =
      !title.trim() && !description.trim() && !street.trim() && !neighborhood.trim() &&
      photos.length === 0 && !(Number(monthlyPrice) > 0) && !bedrooms && !bathrooms && !areaM2;
    if (vazio) return;

    let on = true;
    setSaveStatus("saving");
    const t = setTimeout(async () => {
      if (!on) return;
      const res = await saveDraftData({
        id: draftIdRef.current,
        title,
        city,
        monthlyPrice: Number(monthlyPrice) || 0,
        data: JSON.parse(draftJson),
      });
      if (!on) return;
      if (res.ok) {
        if (res.id) {
          draftIdRef.current = res.id;
          setDraftServerId(res.id);
        }
        setSaveStatus("saved");
        setSavedAt(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
      } else {
        // Falha real de gravação → avisa (não finge sucesso). Demo não tem backend.
        setSaveStatus(res.demo ? "saved" : "error");
      }
    }, 2000);
    return () => {
      on = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approved, draftJson, editId]);

  // Guarda de saída (cinto além do autosave): avisa antes de fechar/recarregar a
  // aba com alteração ainda não persistida — dentro da janela de debounce
  // ("Salvando…") ou após falha de rede ("não salvo"). Ref para não reassinar o
  // listener a cada tecla. Edição (?id) não é rascunho — sem guarda.
  const unsavedRef = useRef(false);
  unsavedRef.current = !editId && (saveStatus === "saving" || saveStatus === "error");
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!unsavedRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // "Novo anúncio detecta rascunho": ao abrir em branco (sem ?draft/?id), busca o
  // rascunho anterior do dono e oferece retomá-lo — em vez de começar do zero e
  // deixar um órfão para trás.
  useEffect(() => {
    if (editId || draftParam) return;
    let alive = true;
    getLatestDraft()
      .then((d) => {
        if (alive && d) setExistingDraft({ id: d.id, pct: draftCompletionPct(d.data as never) });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [editId, draftParam]);

  async function lookupCep(value: string) {
    const digits = value.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        if (data.logradouro) setStreet(data.logradouro);
        if (data.bairro) setNeighborhood(data.bairro);
        if (data.localidade) setCity(data.localidade);
      }
    } catch {
      /* sem rede — preenche manual */
    } finally {
      setCepLoading(false);
    }
  }

  // "Começar outro" (banner de detecção): esquece o rascunho anterior nesta
  // sessão e limpa o formulário para um anúncio novo do zero. O autosave então
  // cria uma linha nova (draftIdRef zerado) — o rascunho anterior fica intacto
  // em Meus imóveis.
  function comecarOutro() {
    setDraftBannerDismissed(true);
    try {
      localStorage.removeItem("vivanomads-novo-draft");
    } catch {}
    draftIdRef.current = null;
    setDraftServerId(null);
    setSaveStatus("idle");
    setStep(0);
    setTitle("");
    setDescription("");
    setPropertyType("apartamento");
    setBedrooms("");
    setBathrooms("");
    setAreaM2("");
    setParkingSpots("");
    setMaxGuests("");
    setMonthlyPrice("");
    setStreet("");
    setNeighborhood("");
    setCep("");
    setVideoUrl("");
    setPhotos([]);
    setSubleaseDoc([]);
    setAmenityKeys({});
    setGooglePlaces([]);
    setManualProximities([]);
  }

  function generateAI() {
    if (photos.length === 0) {
      setAiWarn("Adicione fotos primeiro para gerar uma descrição mais precisa.");
      return;
    }
    setAiWarn(null);
    setAiLoading(true);
    setTimeout(() => {
      setTitle("Apartamento mobiliado com home office, pronto para sua estadia");
      setDescription(
        "Imóvel mobiliado e equipado, pronto para morar. Ambientes claros, cozinha completa e espaço de trabalho — ideal para estadias de média duração. (Descrição gerada com base nas fotos enviadas.)"
      );
      setAiLoading(false);
    }, 900);
  }

  if (approved === null) return null;

  if (!approved) {
    return (
      <div className="mx-auto max-w-xl">
        <PageTitle title="Novo anúncio" />
        <Panel className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-sage-100">
            <Lock className="h-7 w-7 text-forest" />
          </div>
          <h2 className="mt-4 font-title text-xl font-bold text-ink">
            Conclua a qualificação primeiro
          </h2>
          <p className="mx-auto mt-2 max-w-md text-muted">
            O cadastro de imóvel só é liberado depois que o checklist de qualificação retorna{" "}
            <strong>APROVADO PARA PUBLICAR</strong>. É o que garante que o anúncio é locação
            por temporada regular.
          </p>
          <ButtonLink href="/qualificar" variant="gold" className="mt-6">
            <ClipboardCheck className="h-4 w-4" /> Ir para a qualificação
          </ButtonLink>
        </Panel>
      </div>
    );
  }

  const meta = STEP_META[step];
  const StepIcon = meta.icon;

  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle
        title={editingId ? "Editar anúncio" : "Anuncie seu imóvel"}
        subtitle={
          editingId
            ? "Ajuste os dados do imóvel e salve as alterações."
            : "Em 7 etapas. Salvamos seu progresso automaticamente."
        }
        action={
          !editingId && saveStatus !== "idle" ? (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                saveStatus === "saved"
                  ? "bg-sage-100 text-forest"
                  : saveStatus === "error"
                    ? "bg-red-50 text-red-700"
                    : "bg-surface-2 text-muted"
              )}
            >
              {saveStatus === "saved" ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Salvo{savedAt ? ` às ${savedAt}` : ""}
                </>
              ) : saveStatus === "error" ? (
                <>
                  <XCircle className="h-3.5 w-3.5" /> Sem conexão — não salvo
                </>
              ) : (
                "Salvando…"
              )}
            </span>
          ) : undefined
        }
      />

      {/* Banner de boas-vindas (imagem pontual — Bloco IMAGENS) */}
      <div className="relative mb-5 overflow-hidden rounded-2xl">
        <Image
          src={PHOTOS.cadastro.welcome}
          alt="Proprietário com as chaves de um apartamento pronto para anunciar"
          width={800}
          height={300}
          priority
          className="h-28 w-full object-cover sm:h-36"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-night/70 to-night/10" />
        <div className="absolute inset-0 flex flex-col justify-center p-5 text-white">
          <p className="font-title text-lg font-bold sm:text-xl">Vamos publicar seu imóvel</p>
          <p className="text-sm text-white/80">Quanto mais completo, mais visibilidade na busca.</p>
        </div>
      </div>

      {/* Detecção de rascunho em andamento (P0): abriu em branco mas já existe um
          rascunho salvo — oferece retomar de onde parou em vez de recomeçar. */}
      {!editingId && !draftParam && existingDraft && !draftServerId && !draftBannerDismissed && (
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-champagne bg-champagne/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-champagne/40 text-forest">
              <ClipboardCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="font-title text-sm font-bold text-ink">
                Você tem um anúncio em andamento
                {existingDraft.pct > 0 ? ` (${existingDraft.pct}% completo)` : ""}
              </p>
              <p className="text-xs text-muted">
                Retome de onde parou — seus dados foram salvos automaticamente.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={comecarOutro}>
              Começar outro
            </Button>
            <Button
              variant="gold"
              size="sm"
              onClick={() => {
                setDraftBannerDismissed(true);
                router.push(`/dashboard/imoveis/novo?draft=${existingDraft.id}`);
              }}
            >
              Continuar <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Stepper + barra de progresso */}
      <div className="mb-5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible">
          {STEP_META.map((s, i) => (
            <button
              key={s.label}
              type="button"
              onClick={() => i <= step && setStep(i)}
              disabled={i > step}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                i === step
                  ? "bg-forest text-white"
                  : i < step
                    ? "bg-sage-100 text-forest hover:bg-blue-100"
                    : "bg-surface-2 text-muted"
              )}
            >
              {i < step ? <Check className="h-3.5 w-3.5" /> : <span>{i + 1}</span>}
              {s.label}
            </button>
          ))}
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-forest transition-all"
            style={{ width: `${((step + 1) / STEP_META.length) * 100}%` }}
          />
        </div>
      </div>

      <Panel>
        {/* Cabeçalho da etapa */}
        <div className="mb-5 flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sage-100 text-forest">
            <StepIcon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-title text-xl font-bold text-ink">{meta.title}</h2>
            <p className="text-sm text-muted">{meta.subtitle}</p>
          </div>
        </div>

        {/* ── ETAPA 1 — Tipo e operação ── */}
        {step === 0 && (
          <div className="space-y-4">
            <Labeled label="Tipo de imóvel">
              <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)} className="input">
                {PROPERTY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </Labeled>

            <div className="rounded-xl border border-sage-200 p-4">
              <p className="text-sm font-medium text-ink">Quem opera este imóvel?</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {([["own", "É meu (próprio)"], ["subleased", "Opero por sublocação"]] as const).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setOwnershipType(v)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      ownershipType === v ? "border-forest bg-forest text-white" : "border-sage-200 text-ink hover:border-sage"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {ownershipType === "subleased" && (
                <div className="mt-4 space-y-3">
                  <div className="rounded-lg bg-champagne/10 px-3 py-2 text-xs text-ink">
                    Para sublocar legalmente é preciso autorização escrita do proprietário (art.
                    13 da Lei 8.245/91). A declaração abaixo é obrigatória.
                  </div>
                  <Toggle
                    checked={subleaseAuthorized}
                    onChange={() => setSubleaseAuthorized((v) => !v)}
                    label="Tenho autorização do proprietário para sublocar este imóvel"
                    hint="Declaração obrigatória — verificável a qualquer momento."
                  />
                  <div>
                    <span className="mb-1.5 block text-sm font-medium text-ink">
                      Autorização de sublocação <span className="font-normal text-muted">(opcional)</span>
                    </span>
                    <PhotoUploader
                      photos={subleaseDoc}
                      onChange={setSubleaseDoc}
                      uploader={uploadPropertyDoc}
                      remover={removePropertyDoc}
                    />
                    <p className="mt-1.5 text-xs text-muted">
                      Você pode continuar sem enviar agora. Recomendamos anexar a autorização
                      para evitar problemas futuros.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ETAPA 2 — Endereço ── */}
        {step === 1 && (
          <div className="space-y-4">
            <Labeled label="CEP">
              <div className="relative">
                <input
                  value={cep}
                  onChange={(e) => setCep(e.target.value)}
                  onBlur={(e) => lookupCep(e.target.value)}
                  inputMode="numeric"
                  maxLength={9}
                  placeholder="00000-000"
                  className="input"
                />
                {cepLoading && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">buscando…</span>
                )}
              </div>
              <span className="mt-1 block text-xs text-muted">
                Digite o CEP para preencher rua, bairro e cidade automaticamente.
              </span>
            </Labeled>
            <Labeled label="Endereço (rua e número)">
              <input value={street} onChange={(e) => setStreet(e.target.value)} className="input" placeholder="Rua, número" />
            </Labeled>
            <div className="grid grid-cols-2 gap-3">
              <Labeled label="Bairro">
                <input
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  list="novo-bairros"
                  autoComplete="off"
                  className="input"
                />
                <LocationDatalist id="novo-bairros" />
              </Labeled>
              <Labeled label="Cidade">
                <input value={city} onChange={(e) => setCity(e.target.value)} className="input" />
              </Labeled>
            </div>

            {/* Privacidade do endereço (item 5 do QA) */}
            <p className="flex items-start gap-1.5 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage" />
              <span>
                <strong className="text-ink">Rua e número NUNCA aparecem no anúncio público</strong> —
                mostramos só a região aproximada (um círculo do bairro, sem o pino exato). O endereço
                completo é liberado apenas <strong className="text-ink">após o aceite</strong> da candidatura.
              </span>
            </p>
          </div>
        )}

        {/* ── ETAPA 3 — Detalhes ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Labeled label="Quartos">
                <input type="number" min={0} value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} className="input" />
              </Labeled>
              <Labeled label="Banheiros">
                <input type="number" min={0} value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} className="input" />
              </Labeled>
              <Labeled label="Área (m²)">
                <input type="number" min={0} value={areaM2} onChange={(e) => setAreaM2(e.target.value)} className="input" />
              </Labeled>
              <Labeled label="Vagas">
                <input type="number" min={0} value={parkingSpots} onChange={(e) => setParkingSpots(e.target.value)} className="input" />
              </Labeled>
              <Labeled label="Capacidade máxima (pessoas)">
                <input type="number" min={1} value={maxGuests} onChange={(e) => setMaxGuests(e.target.value)} className="input" placeholder="Ex.: 2" />
                <span className="mt-1 block text-xs text-muted">Quantas pessoas o imóvel comporta. Validado no fechamento.</span>
              </Labeled>
            </div>

            <div className="rounded-xl border border-sage-200 p-4">
              <p className="text-sm font-medium text-ink">Disponibilidade e prazo</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Labeled label="Disponível a partir de">
                  <input type="date" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} className="input" />
                </Labeled>
                <Labeled label="Disponível até (opcional)">
                  <input type="date" value={availableUntil} onChange={(e) => setAvailableUntil(e.target.value)} className="input" />
                </Labeled>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Labeled label="Duração mínima">
                  <select value={minPeriod} onChange={(e) => setMinPeriod(e.target.value)} className="input">
                    <option value="30">30 dias</option>
                    <option value="60">60 dias</option>
                    <option value="90">90 dias</option>
                    <option value="180">180 dias</option>
                  </select>
                </Labeled>
                <Labeled label="Duração máxima">
                  <select value={maxPeriod} onChange={(e) => setMaxPeriod(e.target.value)} className="input">
                    <option value="90">90 dias</option>
                    <option value="180">180 dias</option>
                    <option value="365">365 dias</option>
                  </select>
                </Labeled>
              </div>
              <span className="mt-2 block text-xs text-muted">Locação por temporada: 30 a 180 dias é o usual.</span>
            </div>

            <div className="rounded-xl border border-sage-200 p-4">
              <p className="text-sm font-medium text-ink">Faixas de prazo aceitas</p>
              <p className="mb-3 text-xs text-muted">Cada faixa tem regras próprias. Marque as que você aceita.</p>
              <div className="space-y-2">
                {FAIXAS.map((f) => (
                  <div key={f.key}>
                    <Toggle
                      checked={!!faixas[f.key]}
                      onChange={() => setFaixas((s) => ({ ...s, [f.key]: !s[f.key] }))}
                      label={`${f.label} · ${f.resumo}`}
                    />
                    {faixas[f.key] && <p className="ml-1 mt-1 text-xs text-muted">{f.aviso}</p>}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-ink">Regras</p>
              <Toggle checked={furnished} onChange={() => setFurnished((v) => !v)} label="Mobiliado e equipado" hint="Pré-requisito da locação por temporada Viva Nomads." />
              <Toggle checked={petsOk} onChange={() => setPetsOk((v) => !v)} label="Aceita pets" hint="Amplia o público interessado." />
              <Toggle checked={childrenAllowed} onChange={() => setChildrenAllowed((v) => !v)} label="Aceita crianças" />
              <Toggle checked={smokingAllowed} onChange={() => setSmokingAllowed((v) => !v)} label="Permite fumar" />
            </div>
          </div>
        )}

        {/* ── ETAPA 4 — Fotos ── */}
        {step === 3 && (
          <div>
            <div className="rounded-xl border border-sage-200 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-ink">
                  {photos.length} / {MIN_PHOTOS} fotos
                  {photoBlocked && <span className="ml-2 text-red-600">{fotosMsg}</span>}
                </span>
                {photos.length >= MIN_PHOTOS && (
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", TIER_META[tierFromPhotoCount(photos.length)].tone)}>
                    {TIER_META[tierFromPhotoCount(photos.length)].label}
                  </span>
                )}
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={cn("h-full rounded-full transition-all", photoBlocked ? "bg-champagne" : "bg-forest")}
                  style={{ width: `${Math.min(100, (photos.length / 20) * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted">
                8–11 padrão · 12–19 <strong>Anúncio completo</strong> · 20+ <strong>Anúncio premium</strong> (mais prioridade na busca).
              </p>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {SUGGESTED_ROOMS.map((r) => (
                <span key={r} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">{r}</span>
              ))}
            </div>

            {/* Estado vazio amigável (ilustração — Bloco IMAGENS) */}
            {photos.length === 0 && (
              <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-sage-200 bg-surface-2 p-5 text-center">
                <Image src={PHOTOS.cadastro.uploadEmpty} alt="Fotografe os ambientes do imóvel" width={400} height={300} className="h-32 w-auto" />
                <p className="mt-2 text-sm font-medium text-ink">Adicione as fotos dos ambientes</p>
                <p className="text-xs text-muted">Arraste e solte no computador, ou toque para escolher no celular.</p>
              </div>
            )}

            <div className="mt-4">
              {/* Até 24 fotos: permite alcançar o tier "premium" (20+) que a UI promete. */}
              <PhotoUploader photos={photos} onChange={setPhotos} max={24} />
            </div>

            {/* Privacidade das fotos (item 4 do QA): as fotos sobem re-codificadas,
                sem metadados — inclusive a localização (GPS) embutida pelo celular. */}
            <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage" />
              Removemos os metadados das fotos ao enviar — <strong className="text-ink">inclusive a
              localização (GPS)</strong> — para o endereço exato nunca sair na imagem.
            </p>

            {/* Vídeo walk-through (opcional) — reduz o atrito de alugar sem visita */}
            <div className="mt-5 rounded-xl border border-sage-200 p-4">
              <Labeled label="Link do vídeo do imóvel (opcional)">
                <input
                  className="input"
                  type="url"
                  inputMode="url"
                  placeholder="Cole o link do YouTube, Vimeo ou do arquivo de vídeo"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                />
              </Labeled>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
                <PlayCircle className="h-3.5 w-3.5" />
                Um tour em vídeo aumenta a confiança e gera um selo “Vídeo” no anúncio. Grave com o
                celular percorrendo os cômodos.
              </p>
            </div>
          </div>
        )}

        {/* ── ETAPA 5 — Recursos de trabalho ── */}
        {step === 4 && (
          <div className="space-y-4">
            <Image
              src={PHOTOS.cadastro.workspace}
              alt="Home office montado: mesa, cadeira ergonômica e notebook"
              width={1000}
              height={600}
              className="aspect-[16/9] w-full rounded-xl object-cover"
            />
            {qual.tHome && (
              <div className="rounded-xl border border-sage-200 p-4 text-sm text-ink">
                ✓ Da qualificação:{" "}
                <span className="font-medium text-forest">etiqueta “Para trabalhar de casa” ativa.</span>
              </div>
            )}

            {/* Comodidades por categoria (catálogo único) */}
            {AMENITY_GROUPS.map((g) => (
              <div key={g.category}>
                <p className="text-sm font-bold text-forest">{g.label}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {g.items.map((it) => {
                    const on = !!amenityKeys[it.key];
                    return (
                      <button
                        key={it.key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setAmenityKeys((s) => ({ ...s, [it.key]: !s[it.key] }))}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                          on
                            ? "border-forest bg-forest text-white"
                            : "border-sage-200 text-ink hover:border-sage"
                        )}
                      >
                        {it.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Proximidades manuais (sem depender do Google) */}
            <div className="rounded-xl border border-sage-200 p-4">
              <p className="text-sm font-bold text-forest">Proximidades</p>
              <p className="mb-3 text-xs text-muted">
                Liste pontos úteis perto do imóvel (hospital, universidade, mercado…) com a
                distância. Aparecem na seção “O que tem por perto”.
              </p>
              <ManualProximities value={manualProximities} onChange={setManualProximities} />

              {/* Opção avançada: distância automática via Google (requer chave) */}
              <details className="mt-4">
                <summary className="cursor-pointer text-xs font-medium text-muted hover:text-forest">
                  Distância automática pelo Google Maps (opcional, requer chave)
                </summary>
                <div className="mt-3">
                  <PlacesPicker value={googlePlaces} onChange={setGooglePlaces} />
                </div>
              </details>
            </div>
          </div>
        )}

        {/* ── ETAPA 6 — Descrição e preço ── */}
        {step === 5 && (
          <div className="space-y-4">
            {/* Geração por IA atrás de flag (item 7 do QA): desligada até haver
                provedor definido e cobertura na Política de Privacidade. */}
            {GERACAO_IA_ATIVA && (
              <div className="rounded-xl bg-champagne/10 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-forest">Gerar título e descrição com IA</span>
                  <Button size="sm" variant="gold" onClick={generateAI} disabled={aiLoading}>
                    <Sparkles className="h-4 w-4" /> {aiLoading ? "Gerando..." : "Gerar"}
                  </Button>
                </div>
                {aiWarn && <p className="mt-2 text-xs font-medium text-red-600">{aiWarn}</p>}
              </div>
            )}
            <Labeled label="Título do anúncio">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Studio mobiliado no Centro" className="input" />
            </Labeled>
            <Labeled label="Descrição">
              <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className="input" placeholder="Descreva o imóvel..." />
            </Labeled>
            <Labeled label="Aluguel mensal (R$)">
              <input type="number" min={0} value={monthlyPrice} onChange={(e) => setMonthlyPrice(e.target.value)} className="input" placeholder="3200" />
            </Labeled>

            <div className="rounded-xl border border-sage-200 p-4">
              <p className="text-sm font-medium text-ink">Despesas de consumo (água, luz, gás)</p>
              <div className="mt-2 flex gap-2">
                {(["fixed", "real"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setUtilitiesMode(m)}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      utilitiesMode === m ? "border-forest bg-forest text-white" : "border-sage-200 text-ink hover:border-sage"
                    )}
                  >
                    {m === "fixed" ? "Valor fixo estimado" : "Consumo real"}
                  </button>
                ))}
              </div>
              {utilitiesMode === "fixed" ? (
                <div className="mt-3">
                  <p className="mb-2 text-xs text-muted">
                    O inquilino paga um <strong>valor fixo por mês</strong> junto do aluguel. Se o
                    consumo real exceder cerca de 20% da estimativa, há cláusula de ajuste (cobrança
                    complementar, com comprovante — registrada pela plataforma, não intermediada).
                  </p>
                  <Labeled label="Estimativa (R$/mês)">
                    <input type="number" min={0} value={utilitiesEstimate || ""} onChange={(e) => setUtilitiesEstimate(Number(e.target.value))} className="input" placeholder="200" />
                  </Labeled>
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted">
                  O inquilino paga a água, a luz e o gás pelo <strong>consumo real</strong> do
                  período — pelo valor efetivo das faturas, sem valor fixo. Por isso não há nada a
                  preencher aqui: o acerto é feito pelas contas reais.
                </p>
              )}
            </div>

            <Labeled label="Taxa de preparação (R$, única)">
              <input type="number" min={0} value={prepFee || ""} onChange={(e) => setPrepFee(Number(e.target.value))} className="input" placeholder="450" />
              <span className="mt-1 block text-xs text-muted">Limpeza profunda antes da entrada — cobrada uma única vez.</span>
            </Labeled>

            <div className="space-y-2">
              <Toggle checked={issuesInvoice} onChange={() => setIssuesInvoice((v) => !v)} label="Este imóvel emite Nota Fiscal do aluguel" hint="Decisivo para o público corporativo (reembolso pela empresa)." />
            </div>

            <Labeled label="Garantias que você aceita">
              <p className="mb-2 text-xs text-muted">
                Só preferência de aceite — <strong>não muda o caminho do dinheiro</strong> (a
                caução sempre vai para a conta vinculada — conta bancária conjunta à qual a
                plataforma não tem acesso).
              </p>
              <div className="space-y-3">
                {GARANTIAS_CADASTRO.map((g) =>
                  g.disabled ? (
                    // Seguro-fiança visível porém desabilitado até o parceiro fechar.
                    <div
                      key={g.key}
                      className="flex items-center justify-between gap-3 rounded-xl border border-sage-200 bg-surface-2 px-4 py-3 opacity-70"
                    >
                      <span className="text-sm font-medium text-muted">Aceito {g.label}</span>
                      {g.badge && (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                          {g.badge}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div key={g.key}>
                      <Toggle
                        checked={!!garantias[g.key]}
                        onChange={() => setGarantias((s) => ({ ...s, [g.key]: !s[g.key] }))}
                        label={`Aceito ${g.label}`}
                      />
                      {g.microtext && <p className="ml-1 mt-1 text-xs text-muted">{g.microtext}</p>}
                    </div>
                  )
                )}
              </div>
              {!garantiaOk && (
                <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Escolha ao menos uma garantia — contrato sem garantia deixa você sem cobertura de danos.
                </p>
              )}
            </Labeled>
          </div>
        )}

        {/* ── ETAPA 7 — Revisão (preview ao vivo) ── */}
        {step === 6 && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-ink">Prévia do seu anúncio na busca</p>
              <div className="mt-2">
                <PropertyMiniCard property={previewProperty} />
              </div>
            </div>

            {/* Checklist de completude (item 3 do QA): PUBLICAR só com tudo verde. */}
            <div className="rounded-xl border border-sage-200 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-ink">Pronto para publicar?</p>
                <span className="text-xs text-muted">
                  {completude.filter((c) => c.ok).length}/{completude.length}
                </span>
              </div>
              <ul className="mt-3 space-y-1.5">
                {completude.map((c) => (
                  <li key={c.label} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2">
                      {c.ok ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-forest" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                      )}
                      <span className={c.ok ? "text-ink" : "text-muted"}>{c.label}</span>
                    </span>
                    {!c.ok &&
                      ("docItem" in c && c.docItem ? (
                        // O item do documento não é uma etapa do editor: mostra o
                        // estado da moderação em vez de "Resolver".
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            docStatus === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"
                          )}
                        >
                          {docStatus === "rejected" ? "Recusada" : "Em análise"}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setStep(c.step)}
                          className="shrink-0 text-xs font-medium text-forest underline"
                        >
                          Resolver
                        </button>
                      ))}
                  </li>
                ))}
              </ul>
            </div>

            {/* Barra de qualidade do anúncio */}
            <div className="rounded-xl border border-sage-200 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-ink">Qualidade do anúncio</span>
                <span className="font-title font-bold text-forest">{quality}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-forest transition-all" style={{ width: `${quality}%` }} />
              </div>
              {/* Qualidade ACIONÁVEL (item 3): o que ainda dá para somar. */}
              {(() => {
                const dicas = [
                  photos.length < 12 && { t: `Chegar a 12 fotos (tem ${photos.length}) — anúncio completo`, p: "+15%" },
                  photos.length >= 12 && photos.length < 20 && { t: `Chegar a 20 fotos (tem ${photos.length}) — anúncio premium`, p: "+prioridade" },
                  description.trim().length <= 30 && { t: "Descrição com 150+ palavras", p: "+20%" },
                  !qual.baseBadge && { t: "Conquistar o selo Pronto para Morar na qualificação", p: "+20%" },
                ].filter(Boolean) as { t: string; p: string }[];
                if (dicas.length === 0)
                  return <p className="mt-2 text-xs text-forest">Ótimo — seu anúncio está no topo da qualidade. 🏅</p>;
                return (
                  <details className="mt-2 group">
                    <summary className="cursor-pointer list-none text-xs font-medium text-forest">
                      O que aumenta a qualidade ({dicas.length})
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {dicas.map((d) => (
                        <li key={d.t} className="flex items-center justify-between gap-2 text-xs text-muted">
                          <span>{d.t}</span>
                          <span className="shrink-0 font-semibold text-forest">{d.p}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                );
              })()}
            </div>

            {photoBlocked && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <strong>{fotosMsg} para publicar.</strong> O mínimo é {MIN_PHOTOS}. Você pode salvar como rascunho e completar depois.{" "}
                <button type="button" onClick={() => setStep(3)} className="font-medium underline">Ir para Fotos</button>.
              </div>
            )}
            {subleaseBlocked && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <strong>Publicação bloqueada.</strong> Confirme a autorização de sublocação no passo{" "}
                <button type="button" onClick={() => setStep(0)} className="font-medium underline">Tipo e operação</button>.
              </div>
            )}

            {/* Portão da verificação do documento (item 1). Não aparece na edição
                de um imóvel já existente. */}
            {!editingId && docStatus === "pending" && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <strong>Documentação em análise.</strong> Nossa equipe está verificando a matrícula/contrato.
                  Você pode <strong>salvar como rascunho</strong> e continuar editando; a publicação libera
                  assim que o documento for aprovado (avisamos por e-mail).
                </span>
              </div>
            )}
            {!editingId && docStatus === "rejected" && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <strong>Documentação não aprovada.</strong>
                  {docReason ? ` Motivo: ${docReason}.` : ""} Reenvie o documento na{" "}
                  <a href="/qualificar" className="font-medium underline">qualificação</a> para liberar a publicação.
                </span>
              </div>
            )}
            {!editingId && docStatus === "approved" && (
              <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
                <DocConferidaBadge size="sm" />
                <span>Documento conferido pela equipe — você já pode publicar.</span>
              </div>
            )}
            {publishError && <p className="text-sm text-red-600">{publishError}</p>}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => publish(true)} disabled={publishing || subleaseBlocked}>
                {editingId ? "Salvar sem publicar" : "Salvar como rascunho"}
              </Button>
              <Button
                variant={podePublicar ? "gold" : "outline"}
                onClick={() => publish(false)}
                disabled={publishing || !podePublicar}
                title={podePublicar ? undefined : "Resolva os itens pendentes acima"}
                className={podePublicar ? undefined : "cursor-not-allowed opacity-60"}
              >
                {publishing
                  ? "Salvando..."
                  : editingId
                    ? "Salvar alterações"
                    : "Publicar anúncio"}
              </Button>
            </div>
          </div>
        )}

        {/* Navegação */}
        {step < LAST && (
          <div className="mt-6 flex justify-between">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            <Button onClick={() => setStep((s) => Math.min(LAST, s + 1))}>
              Continuar <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </Panel>

      <p className="mt-4 text-center text-sm text-muted">
        <Link href="/dashboard/imoveis" className="hover:text-forest">Cancelar e voltar</Link>
      </p>

      <style>{`.input{width:100%;border-radius:0.75rem;border:1px solid var(--color-sage-200);background:#fff;padding:0.625rem 0.875rem;font-size:0.875rem;outline:none}.input:focus{border-color:var(--color-sage)}`}</style>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
        checked ? "border-forest bg-sage-100" : "border-sage-200 hover:border-sage"
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border",
          checked ? "border-forest bg-forest text-white" : "border-sage-200 bg-white"
        )}
      >
        {checked && <Check className="h-4 w-4" />}
      </span>
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </button>
  );
}
