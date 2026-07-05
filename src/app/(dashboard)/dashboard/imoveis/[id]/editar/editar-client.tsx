"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Camera,
  CalendarRange,
  FileText,
  Briefcase,
  ScrollText,
  Ruler,
  Check,
  ChevronDown,
  Share2,
  ExternalLink,
  Info,
  Loader2,
  Dog,
  Cigarette,
  Baby,
} from "lucide-react";
import { PageTitle } from "@/components/dashboard/primitives";
import { Button, ButtonLink } from "@/components/ui/button";
import { PhotoUploader, type PhotoItem } from "@/components/photo-uploader";
import { AMENITY_GROUPS, amenityKeysFromLabels } from "@/lib/amenities";
import { completudeAnuncio } from "@/lib/listing-completude";
import { updateProperty, type PropertyInput } from "@/lib/data/actions";
import type { Property } from "@/lib/types";
import { formatBRL, cn } from "@/lib/utils";

const MIN_DESC = 60;

/** Só entradas que são URL de verdade viram foto (ignora rótulos/placeholder). */
const isPhotoUrl = (s?: string) =>
  typeof s === "string" && (/^https?:\/\//.test(s) || s.startsWith("/"));

/** Micro-texto por categoria de comodidade (por que preencher). */
const AMENITY_HINT: Record<string, string> = {
  trabalho: "O que faz o nômade digital escolher o seu imóvel — aparece nos filtros de trabalho.",
  conforto: "Itens do dia a dia que o inquilino procura e filtra na busca.",
  predio: "Comodidades do prédio/condomínio contam pontos e passam confiança.",
};

/** Sugestões para uma descrição que converte (descrição guiada). */
const DESC_PROMPTS = [
  "Para quem é ideal (profissional em transição, família, intercâmbio…)",
  "O diferencial do imóvel (vista, silêncio, home office, localização)",
  "O que já vem pronto (mobília, enxoval, internet, utensílios)",
  "O bairro: o que há por perto (mercado, farmácia, parque, transporte)",
];

export function EditarImovelClient({
  property,
  demo,
}: {
  property: Property;
  demo: boolean;
}) {
  // ── Estado editável (prefill do imóvel carregado) ──────────────────────────
  const [title, setTitle] = useState(property.title ?? "");
  const [description, setDescription] = useState(property.description ?? "");
  const [photos, setPhotos] = useState<PhotoItem[]>(
    (property.photos ?? []).filter(isPhotoUrl).map((url, i) => ({
      id: `p-${i}`,
      url,
      name: "",
      path: null,
      demo: false,
    }))
  );
  const [availableFrom, setAvailableFrom] = useState(property.availableFrom?.slice(0, 10) ?? "");
  const [availableUntil, setAvailableUntil] = useState(property.availableUntil?.slice(0, 10) ?? "");
  const [minPeriod, setMinPeriod] = useState(String(property.minPeriodDays || 30));
  const [maxPeriod, setMaxPeriod] = useState(String(property.maxPeriodDays || 180));
  const [amenityKeys, setAmenityKeys] = useState<Record<string, boolean>>(
    Object.fromEntries(amenityKeysFromLabels(property.amenities ?? []).map((k) => [k, true]))
  );
  const [petsAllowed, setPetsAllowed] = useState(property.petsAllowed ?? false);
  const [smokingAllowed, setSmokingAllowed] = useState(property.smokingAllowed ?? false);
  const [childrenAllowed, setChildrenAllowed] = useState(property.childrenAllowed ?? true);
  const [bedrooms, setBedrooms] = useState(String(property.bedrooms || ""));
  const [bathrooms, setBathrooms] = useState(String(property.bathrooms || ""));
  const [areaM2, setAreaM2] = useState(String(property.areaM2 || ""));
  const [maxGuests, setMaxGuests] = useState(String(property.maxGuests || ""));
  const [monthlyPrice, setMonthlyPrice] = useState(String(property.monthlyPrice || ""));
  const [condoFee, setCondoFee] = useState(String(property.condoFee || ""));

  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [savedSection, setSavedSection] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Completude ao vivo (reaproveita a regra pura — min. 5 fotos p/ publicar).
  const comp = useMemo(
    () =>
      completudeAnuncio({
        photos: photos.map((p) => p.url),
        description,
        monthlyPrice: Number(monthlyPrice) || 0,
        maxGuests: Number(maxGuests) || 0,
        areaM2: Number(areaM2) || 0,
        availableFrom,
        garantiasAceitas: property.garantiasAceitas ?? [],
        readyToLiveBadge: property.readyToLiveBadge,
        videoUrl: property.videoUrl,
      }),
    [
      photos,
      description,
      monthlyPrice,
      maxGuests,
      areaM2,
      availableFrom,
      property.garantiasAceitas,
      property.readyToLiveBadge,
      property.videoUrl,
    ]
  );

  /** Monta o PropertyInput COMPLETO a partir do estado atual + pass-through. */
  function buildInput(asDraft?: boolean): PropertyInput {
    return {
      title: title.trim() || property.title,
      description,
      propertyType: property.propertyType,
      city: property.city,
      neighborhood: property.neighborhood,
      bedrooms: Number(bedrooms) || 0,
      bathrooms: Number(bathrooms) || 0,
      areaM2: Number(areaM2) || 0,
      minPeriodDays: Number(minPeriod) || 30,
      monthlyPrice: Number(monthlyPrice) || 0,
      readyToLiveScore: property.readyToLiveScore ?? (property.readyToLiveBadge ? 70 : 0),
      tagHomeOffice: property.tagHomeOffice,
      tagWorkLocated: property.tagWorkLocated,
      tagCondoApproved: property.tagCondoApproved,
      ownershipType: property.ownershipType,
      subleaseAuthorized: property.subleaseAuthorized,
      utilitiesMode: property.utilitiesMode,
      utilitiesEstimate: property.utilitiesEstimate,
      issuesInvoice: property.issuesInvoice,
      acceptsInsurance: property.acceptsInsurance,
      faixasAceitas: property.faixasAceitas ?? [],
      garantiasAceitas: property.garantiasAceitas ?? [],
      prepFee: property.prepFee,
      lat: property.lat,
      lng: property.lng,
      photoUrls: photos.map((p) => p.url).filter((u) => u && !u.startsWith("blob:")),
      videoUrl: property.videoUrl,
      asDraft,
      parkingSpots: property.parkingSpots,
      condoFee: Number(condoFee) || 0,
      availableFrom: availableFrom || undefined,
      availableUntil: availableUntil || undefined,
      maxPeriodDays: Number(maxPeriod) || undefined,
      furnished: property.furnished,
      petsAllowed,
      smokingAllowed,
      childrenAllowed,
      maxGuests: Number(maxGuests) || undefined,
      amenityKeys: Object.keys(amenityKeys).filter((k) => amenityKeys[k]),
      googlePlaces: property.googlePlaces ?? [],
      proximities: (property.proximities ?? []).map((p) => ({
        category: p.category,
        name: p.name,
        note: p.note,
      })),
    };
  }

  async function saveSection(key: string, asDraft?: boolean) {
    setSavingSection(key);
    setErro(null);
    setSavedSection(null);
    const res = await updateProperty(property.id, buildInput(asDraft));
    setSavingSection(null);
    if (res.ok) {
      setSavedSection(key);
      setTimeout(() => setSavedSection((s) => (s === key ? null : s)), 2500);
    } else {
      setErro(res.error ?? "Não foi possível salvar.");
    }
  }

  async function publish() {
    if (!comp.podePublicar) return;
    setPublishing(true);
    await saveSection("publicar", false);
    setPublishing(false);
  }

  function toggleAmenity(k: string) {
    setAmenityKeys((prev) => ({ ...prev, [k]: !prev[k] }));
  }

  async function share() {
    const url = `${window.location.origin}/imoveis/${property.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard bloqueado — ignora */
    }
  }

  const publicUrl = `/imoveis/${property.id}`;

  return (
    <div>
      <PageTitle
        title="Editar anúncio"
        subtitle={property.title}
        action={
          <ButtonLink href="/dashboard/imoveis" variant="outline" size="sm">
            Voltar aos imóveis
          </ButtonLink>
        }
      />

      {demo && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <Info className="h-4 w-4 shrink-0" /> Pré-visualização (sem backend): as edições não são
          gravadas neste ambiente.
        </p>
      )}

      {/* ── Barra de completude + publicar/compartilhar ─────────────────────── */}
      <div className="mb-6 rounded-2xl border border-sage-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-title text-lg font-bold text-ink">
              Anúncio {comp.pct}% completo
            </p>
            {comp.pct < 100 ? (
              <p className="mt-0.5 text-sm text-muted">
                Falta: {comp.faltando.slice(0, 4).join(" · ")}
                {comp.faltando.length > 4 ? " …" : ""}
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-forest">
                Tudo pronto — seu anúncio está completo. 🎉
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {comp.pct >= 100 && (
              <Button variant="outline" size="sm" onClick={share}>
                {copied ? (
                  <>
                    <Check className="h-4 w-4" /> Link copiado
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4" /> Compartilhar
                  </>
                )}
              </Button>
            )}
            <Button variant="gold" size="sm" onClick={publish} disabled={!comp.podePublicar || publishing}>
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Publicar
            </Button>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-forest transition-all"
            style={{ width: `${comp.pct}%` }}
          />
        </div>
        {!comp.podePublicar && (
          <p className="mt-2 text-xs text-amber-700">
            Para publicar são necessárias no mínimo <strong>5 fotos</strong>.
          </p>
        )}
        {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
      </div>

      {/* ── Seções editáveis ─────────────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* Fotos */}
        <Section
          icon={Camera}
          title="Fotos"
          summary={`${photos.length} foto(s) · capa: ${photos[0]?.name || "1ª foto"}`}
          saving={savingSection === "fotos"}
          saved={savedSection === "fotos"}
          onSave={() => saveSection("fotos")}
        >
          <p className="mb-3 text-sm text-muted">
            A <strong>primeira foto é a capa</strong>. Arraste para reordenar ou use a estrela para
            definir a capa. Mínimo de 5 para publicar.
          </p>
          <PhotoUploader photos={photos} onChange={setPhotos} max={20} />
        </Section>

        {/* Disponibilidade — 2 inputs claros */}
        <Section
          icon={CalendarRange}
          title="Disponibilidade"
          summary={
            availableFrom
              ? `A partir de ${br(availableFrom)}${availableUntil ? ` até ${br(availableUntil)}` : ""}`
              : "Sem data definida"
          }
          saving={savingSection === "disp"}
          saved={savedSection === "disp"}
          onSave={() => saveSection("disp")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-ink">Disponível a partir de</span>
              <input
                type="date"
                value={availableFrom}
                onChange={(e) => setAvailableFrom(e.target.value)}
                className="w-full rounded-xl border border-sage-200 px-3 py-2.5 outline-none focus:border-sage"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-ink">Disponível até (opcional)</span>
              <input
                type="date"
                value={availableUntil}
                min={availableFrom || undefined}
                onChange={(e) => setAvailableUntil(e.target.value)}
                className="w-full rounded-xl border border-sage-200 px-3 py-2.5 outline-none focus:border-sage"
              />
            </label>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-ink">Estadia mínima (dias)</span>
              <input
                type="number"
                min={1}
                value={minPeriod}
                onChange={(e) => setMinPeriod(e.target.value)}
                className="w-full rounded-xl border border-sage-200 px-3 py-2.5 outline-none focus:border-sage"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-ink">Estadia máxima (dias)</span>
              <input
                type="number"
                min={Number(minPeriod) || 1}
                value={maxPeriod}
                onChange={(e) => setMaxPeriod(e.target.value)}
                className="w-full rounded-xl border border-sage-200 px-3 py-2.5 outline-none focus:border-sage"
              />
            </label>
          </div>
        </Section>

        {/* Título & descrição — guiada */}
        <Section
          icon={FileText}
          title="Título & descrição"
          summary={`${description.trim().length} caractere(s)`}
          saving={savingSection === "desc"}
          saved={savedSection === "desc"}
          onSave={() => saveSection("desc")}
        >
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink">Título do anúncio</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Studio mobiliado com home office no Centro"
              className="w-full rounded-xl border border-sage-200 px-3 py-2.5 outline-none focus:border-sage"
            />
          </label>
          <label className="mt-4 block text-sm">
            <span className="mb-1 block font-medium text-ink">Descrição</span>
            <textarea
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o imóvel para quem vai morar aqui…"
              className={cn(
                "w-full rounded-xl border px-3 py-2.5 outline-none focus:border-sage",
                description.trim().length > 0 && description.trim().length < MIN_DESC
                  ? "border-amber-300"
                  : "border-sage-200"
              )}
            />
          </label>
          <p className="mt-1 text-xs text-muted">
            {description.trim().length}/{MIN_DESC}+ caracteres
            {description.trim().length < MIN_DESC && " — capriche para converter mais."}
          </p>
          <div className="mt-3 rounded-xl bg-surface-2 p-3">
            <p className="text-xs font-medium text-ink">O que incluir:</p>
            <ul className="mt-1.5 grid gap-1">
              {DESC_PROMPTS.map((p) => (
                <li key={p} className="flex items-start gap-2 text-xs text-muted">
                  <span className="text-sage">•</span> {p}
                </li>
              ))}
            </ul>
          </div>
        </Section>

        {/* Comodidades — micro-texto por grupo */}
        <Section
          icon={Briefcase}
          title="Comodidades"
          summary={`${Object.values(amenityKeys).filter(Boolean).length} selecionada(s)`}
          saving={savingSection === "amen"}
          saved={savedSection === "amen"}
          onSave={() => saveSection("amen")}
        >
          <div className="space-y-5">
            {AMENITY_GROUPS.map((g) => (
              <div key={g.category}>
                <p className="font-medium text-ink">{g.label}</p>
                <p className="mb-2 text-xs text-muted">{AMENITY_HINT[g.category] ?? ""}</p>
                <div className="flex flex-wrap gap-2">
                  {g.items.map((it) => {
                    const on = !!amenityKeys[it.key];
                    return (
                      <button
                        key={it.key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleAmenity(it.key)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                          on
                            ? "border-forest bg-sage-100 text-forest"
                            : "border-sage-200 text-muted hover:border-sage"
                        )}
                      >
                        {on && <Check className="h-3.5 w-3.5" />}
                        {it.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Regras da casa */}
        <Section
          icon={ScrollText}
          title="Regras da casa"
          summary={[
            petsAllowed ? "aceita pets" : "sem pets",
            smokingAllowed ? "fumar ok" : "não fumantes",
            childrenAllowed ? "aceita crianças" : "sem crianças",
          ].join(" · ")}
          saving={savingSection === "regras"}
          saved={savedSection === "regras"}
          onSave={() => saveSection("regras")}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <RuleCard
              icon={Dog}
              label="Aceita animais de estimação?"
              value={petsAllowed}
              onChange={setPetsAllowed}
            />
            <RuleCard
              icon={Cigarette}
              label="Permite fumar no imóvel?"
              value={smokingAllowed}
              onChange={setSmokingAllowed}
            />
            <RuleCard
              icon={Baby}
              label="Adequado para crianças?"
              value={childrenAllowed}
              onChange={setChildrenAllowed}
            />
          </div>
        </Section>

        {/* Detalhes & preço */}
        <Section
          icon={Ruler}
          title="Detalhes & preço"
          summary={`${bedrooms || 0}q · ${areaM2 || 0}m² · ${formatBRL(Number(monthlyPrice) || 0)}/mês`}
          saving={savingSection === "detalhes"}
          saved={savedSection === "detalhes"}
          onSave={() => saveSection("detalhes")}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <NumField label="Quartos" value={bedrooms} onChange={setBedrooms} />
            <NumField label="Banheiros" value={bathrooms} onChange={setBathrooms} />
            <NumField label="Área (m²)" value={areaM2} onChange={setAreaM2} />
            <NumField label="Capacidade (pessoas)" value={maxGuests} onChange={setMaxGuests} />
            <NumField label="Aluguel (R$/mês)" value={monthlyPrice} onChange={setMonthlyPrice} />
            <NumField label="Condomínio (R$/mês)" value={condoFee} onChange={setCondoFee} />
          </div>
        </Section>
      </div>

      {/* Ver anúncio público */}
      <div className="mt-6">
        <Link
          href={publicUrl}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-forest hover:underline"
        >
          <ExternalLink className="h-4 w-4" /> Ver como aparece na busca
        </Link>
      </div>
    </div>
  );
}

/** Bloco colapsável de seção com resumo + salvar. */
function Section({
  icon: Icon,
  title,
  summary,
  children,
  saving,
  saved,
  onSave,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  summary: string;
  children: React.ReactNode;
  saving: boolean;
  saved: boolean;
  onSave: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="overflow-hidden rounded-2xl border border-sage-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-surface-2"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sage-100 text-forest">
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-title font-bold text-ink">{title}</span>
          <span className="block truncate text-sm text-muted">{summary}</span>
        </span>
        {saved && <span className="text-sm font-medium text-forest">Salvo ✓</span>}
        <ChevronDown
          className={cn("h-5 w-5 shrink-0 text-muted transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="border-t border-sage-200 px-5 py-5">
          {children}
          <div className="mt-5 flex items-center justify-end gap-3">
            {saved && <span className="text-sm text-forest">Alterações salvas.</span>}
            <Button variant="gold" size="sm" onClick={onSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Salvando…
                </>
              ) : (
                "Salvar seção"
              )}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function RuleCard({
  icon: Icon,
  label,
  value,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="rounded-xl border border-sage-200 p-4">
      <div className="flex items-center gap-2 text-ink">
        <Icon className="h-4 w-4 text-sage" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="mt-3 flex rounded-full bg-surface-2 p-0.5 text-sm">
        {[
          { v: true, l: "Sim" },
          { v: false, l: "Não" },
        ].map((o) => (
          <button
            key={o.l}
            type="button"
            aria-pressed={value === o.v}
            onClick={() => onChange(o.v)}
            className={cn(
              "flex-1 rounded-full px-3 py-1.5 font-medium transition-colors",
              value === o.v ? "bg-forest text-white" : "text-muted"
            )}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block font-medium text-ink">{label}</span>
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        className="w-full rounded-xl border border-sage-200 px-3 py-2.5 outline-none focus:border-sage"
      />
    </label>
  );
}

/** Data ISO → dd/mm/aa. */
function br(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y.slice(2)}`;
}
