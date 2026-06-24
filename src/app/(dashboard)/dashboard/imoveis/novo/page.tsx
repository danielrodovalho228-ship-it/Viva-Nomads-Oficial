"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { createProperty } from "@/lib/data/actions";
import { geocodeForSave } from "@/lib/integrations/geocoding";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { Button, ButtonLink } from "@/components/ui/button";
import { PropertyMiniCard } from "@/components/property-mini-card";
import { PhotoUploader, type PhotoItem } from "@/components/photo-uploader";
import { MIN_PHOTOS, SUGGESTED_ROOMS, tierFromPhotoCount, TIER_META } from "@/lib/listing";
import { GARANTIAS } from "@/lib/guarantees";
import { LocationDatalist } from "@/lib/locations";
import { PHOTOS } from "@/lib/media";
import type { Property } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Metadados das 7 etapas do wizard (rodada 15). */
const STEP_META = [
  { label: "Tipo", icon: Home, title: "Tipo e operação", subtitle: "Que imóvel é e quem o opera." },
  { label: "Endereço", icon: MapPin, title: "Endereço", subtitle: "Onde fica o imóvel." },
  { label: "Detalhes", icon: BedDouble, title: "Detalhes do imóvel", subtitle: "Cômodos, área e período." },
  { label: "Fotos", icon: Camera, title: "Fotos do imóvel", subtitle: "Mínimo de 8 — anúncio bem fotografado se destaca." },
  { label: "Trabalho", icon: Briefcase, title: "Recursos de trabalho", subtitle: "O que torna o imóvel bom para quem trabalha." },
  { label: "Preço", icon: Tag, title: "Descrição e preço", subtitle: "Como o anúncio se apresenta e quanto custa." },
  { label: "Revisão", icon: CheckCircle2, title: "Revisão", subtitle: "Confira tudo antes de publicar." },
] as const;
const LAST = STEP_META.length - 1;

export default function NewPropertyPage() {
  const [approved, setApproved] = useState<boolean | null>(null);
  const [step, setStep] = useState(0);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiWarn, setAiWarn] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [propertyType, setPropertyType] = useState("Apartamento");
  const [description, setDescription] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [areaM2, setAreaM2] = useState("");
  const [minPeriod, setMinPeriod] = useState("30");
  const [furnished, setFurnished] = useState(true);
  const [petsOk, setPetsOk] = useState(false);
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
  const [acceptsInsurance, setAcceptsInsurance] = useState(false);
  // Modalidades de garantia que o proprietário ACEITA (só preferência de
  // aceite — não muda o caminho do dinheiro). Caução e título por padrão.
  const [aceitaGarantia, setAceitaGarantia] = useState<Record<string, boolean>>({
    caucao: true,
    titulo: true,
    garantidor_digital: false,
  });
  const [prepFee, setPrepFee] = useState(450);
  const [ownershipType, setOwnershipType] = useState<"own" | "subleased">("own");
  const [subleaseAuthorized, setSubleaseAuthorized] = useState(false);
  const [subleaseDoc, setSubleaseDoc] = useState<PhotoItem[]>([]);
  const [qual, setQual] = useState({ baseBadge: false, tHome: false, tWork: false });
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const router = useRouter();

  const subleaseBlocked = ownershipType === "subleased" && !subleaseAuthorized;
  const photosMissing = Math.max(0, MIN_PHOTOS - photos.length);
  const photoBlocked = photos.length < MIN_PHOTOS;

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
    title: title || "Seu anúncio",
    propertyType,
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
    if (!asDraft && photoBlocked) {
      setPublishError(`Adicione pelo menos ${MIN_PHOTOS} fotos para publicar. Faltam ${photosMissing}.`);
      return;
    }
    if (subleaseBlocked) {
      setPublishError("Imóvel operado por sublocação exige a confirmação de autorização do proprietário antes de publicar.");
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

    const res = await createProperty({
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
      subleaseDocUrl: subleaseDoc[0]?.url,
      utilitiesMode,
      utilitiesEstimate,
      issuesInvoice,
      acceptsInsurance,
      garantiasAceitas: Object.keys(aceitaGarantia).filter((k) => aceitaGarantia[k]),
      prepFee,
      lat: coords.lat,
      lng: coords.lng,
      photoUrls: photos.map((p) => p.url),
      videoUrl: videoUrl.trim() || undefined,
    });

    setPublishing(false);
    if (!res.ok) {
      setPublishError(res.error ?? "Não foi possível publicar.");
      return;
    }
    try {
      localStorage.removeItem("vivanomads-novo-draft");
    } catch {}
    router.push("/dashboard/imoveis");
  }

  useEffect(() => {
    const raw = sessionStorage.getItem("vivanomads-qualification");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setApproved(raw ? JSON.parse(raw).eligible === true : false);
    try {
      if (raw) {
        const q = JSON.parse(raw);
        setQual({ baseBadge: !!q.baseBadge, tHome: !!q.tHome, tWork: !!q.tWork });
      }
      const draft = localStorage.getItem("vivanomads-novo-draft");
      if (draft) {
        const d = JSON.parse(draft);
        if (d.title) setTitle(d.title);
        if (d.propertyType) setPropertyType(d.propertyType);
        if (d.description) setDescription(d.description);
        if (d.bedrooms) setBedrooms(d.bedrooms);
        if (d.bathrooms) setBathrooms(d.bathrooms);
        if (d.areaM2) setAreaM2(d.areaM2);
        if (d.minPeriod) setMinPeriod(d.minPeriod);
        if (d.monthlyPrice) setMonthlyPrice(d.monthlyPrice);
        if (typeof d.furnished === "boolean") setFurnished(d.furnished);
        if (typeof d.petsOk === "boolean") setPetsOk(d.petsOk);
        if (d.street) setStreet(d.street);
        if (d.neighborhood) setNeighborhood(d.neighborhood);
        if (d.city) setCity(d.city);
        if (d.cep) setCep(d.cep);
        if (d.ownershipType) setOwnershipType(d.ownershipType);
        if (d.videoUrl) setVideoUrl(d.videoUrl);
      }
    } catch {}
  }, []);

  // Auto-save do rascunho + indicador "Salvo ✓" (Bloco F).
  useEffect(() => {
    if (approved !== true) return;
    const draft = {
      title, propertyType, description, bedrooms, bathrooms, areaM2, minPeriod, monthlyPrice,
      furnished, petsOk, street, neighborhood, city, cep, ownershipType, videoUrl,
    };
    try {
      localStorage.setItem("vivanomads-novo-draft", JSON.stringify(draft));
    } catch {}
    let on = true;
    const t1 = setTimeout(() => on && setSaveStatus("saving"), 0);
    const t2 = setTimeout(() => on && setSaveStatus("saved"), 500);
    return () => {
      on = false;
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [approved, title, propertyType, description, bedrooms, bathrooms, areaM2, minPeriod, monthlyPrice, furnished, petsOk, street, neighborhood, city, cep, ownershipType, videoUrl]);

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
        title="Anuncie seu imóvel"
        subtitle="Em 7 etapas. Salvamos seu progresso automaticamente."
        action={
          saveStatus !== "idle" ? (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                saveStatus === "saved" ? "bg-sage-100 text-forest" : "bg-surface-2 text-muted"
              )}
            >
              {saveStatus === "saved" ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Rascunho salvo
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
                <option>Apartamento</option>
                <option>Casa</option>
                <option>Studio</option>
                <option>Kitnet</option>
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
                    <PhotoUploader photos={subleaseDoc} onChange={setSubleaseDoc} />
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
          </div>
        )}

        {/* ── ETAPA 3 — Detalhes ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Labeled label="Quartos">
                <input type="number" min={0} value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} className="input" />
              </Labeled>
              <Labeled label="Banheiros">
                <input type="number" min={0} value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} className="input" />
              </Labeled>
              <Labeled label="Área (m²)">
                <input type="number" min={0} value={areaM2} onChange={(e) => setAreaM2(e.target.value)} className="input" />
              </Labeled>
            </div>
            <Labeled label="Período mínimo de locação">
              <select value={minPeriod} onChange={(e) => setMinPeriod(e.target.value)} className="input">
                <option value="30">30 dias</option>
                <option value="60">60 dias</option>
                <option value="90">90 dias</option>
                <option value="180">180 dias</option>
              </select>
              <span className="mt-1 block text-xs text-muted">Locação por temporada: 30 a 180 dias.</span>
            </Labeled>
            <div className="space-y-2">
              <Toggle checked={furnished} onChange={() => setFurnished((v) => !v)} label="Mobiliado e equipado" hint="Pré-requisito da locação por temporada Viva Nomads." />
              <Toggle checked={petsOk} onChange={() => setPetsOk((v) => !v)} label="Aceita pets" hint="Amplia o público interessado." />
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
                  {photoBlocked && <span className="ml-2 text-red-600">Faltam {photosMissing}</span>}
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
              <PhotoUploader photos={photos} onChange={setPhotos} />
            </div>

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
            <div className="rounded-xl border border-sage-200 p-4 text-sm text-ink">
              ✓ Importados da qualificação: home office, mesa, internet fibra.{" "}
              {qual.tHome && <span className="font-medium text-forest">Etiqueta “Para trabalhar de casa” ativa.</span>}
            </div>
            <Labeled label="Espaços de trabalho próximos (nome — distância)">
              <input className="input" placeholder="Coworking Center — 850 m" />
            </Labeled>
          </div>
        )}

        {/* ── ETAPA 6 — Descrição e preço ── */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="rounded-xl bg-champagne/10 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-forest">
                  Gerar título e descrição com IA <span className="text-muted">(usa suas fotos como contexto)</span>
                </span>
                <Button size="sm" variant="gold" onClick={generateAI} disabled={aiLoading}>
                  <Sparkles className="h-4 w-4" /> {aiLoading ? "Gerando..." : "Gerar"}
                </Button>
              </div>
              {aiWarn && <p className="mt-2 text-xs font-medium text-red-600">{aiWarn}</p>}
            </div>
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
              {utilitiesMode === "fixed" && (
                <div className="mt-3">
                  <Labeled label="Estimativa (R$/mês)">
                    <input type="number" min={0} value={utilitiesEstimate || ""} onChange={(e) => setUtilitiesEstimate(Number(e.target.value))} className="input" placeholder="200" />
                  </Labeled>
                </div>
              )}
            </div>

            <Labeled label="Taxa de preparação (R$, única)">
              <input type="number" min={0} value={prepFee || ""} onChange={(e) => setPrepFee(Number(e.target.value))} className="input" placeholder="450" />
              <span className="mt-1 block text-xs text-muted">Limpeza profunda antes da entrada — cobrada uma única vez.</span>
            </Labeled>

            <div className="space-y-2">
              <Toggle checked={issuesInvoice} onChange={() => setIssuesInvoice((v) => !v)} label="Este imóvel emite Nota Fiscal do aluguel" hint="Decisivo para o público corporativo (reembolso pela empresa)." />
              <Toggle checked={acceptsInsurance} onChange={() => setAcceptsInsurance((v) => !v)} label="Aceito seguro-fiança como garantia" hint="Exibe o selo 'Aceita Seguro-Fiança' no anúncio." />
            </div>

            <Labeled label="Modalidades de garantia que você aceita">
              <p className="mb-2 text-xs text-muted">
                Só preferência de aceite — <strong>não muda o caminho do dinheiro</strong> (a
                caução sempre vai para conta vinculada, nunca para a plataforma).
              </p>
              <div className="space-y-2">
                {GARANTIAS.map((g) => (
                  <Toggle
                    key={g.id}
                    checked={!!aceitaGarantia[g.id]}
                    onChange={() => setAceitaGarantia((s) => ({ ...s, [g.id]: !s[g.id] }))}
                    label={`Aceito ${g.nome}`}
                    hint={g.status === "ativo" ? undefined : "Disponível em breve — via parceiro."}
                  />
                ))}
              </div>
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

            {/* Barra de qualidade do anúncio */}
            <div className="rounded-xl border border-sage-200 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-ink">Qualidade do anúncio</span>
                <span className="font-title font-bold text-forest">{quality}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-forest transition-all" style={{ width: `${quality}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted">Fotos + descrição + selo aumentam a visibilidade.</p>
            </div>

            {photoBlocked && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <strong>Faltam {photosMissing} foto(s) para publicar.</strong> O mínimo é {MIN_PHOTOS}. Você pode salvar como rascunho e completar depois.{" "}
                <button type="button" onClick={() => setStep(3)} className="font-medium underline">Ir para Fotos</button>.
              </div>
            )}
            {subleaseBlocked && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <strong>Publicação bloqueada.</strong> Confirme a autorização de sublocação no passo{" "}
                <button type="button" onClick={() => setStep(0)} className="font-medium underline">Tipo e operação</button>.
              </div>
            )}
            {publishError && <p className="text-sm text-red-600">{publishError}</p>}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => publish(true)} disabled={publishing || subleaseBlocked}>
                Salvar como rascunho
              </Button>
              <Button variant="gold" onClick={() => publish(false)} disabled={publishing || subleaseBlocked || photoBlocked}>
                {publishing ? "Publicando..." : "Publicar anúncio"}
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
