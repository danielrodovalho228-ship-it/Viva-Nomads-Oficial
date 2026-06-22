"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  Upload,
  Award,
  ArrowRight,
  AlertTriangle,
  Laptop,
  MapPin,
  Info,
} from "lucide-react";
import {
  type EligibilityState,
  type QualityState,
  eligibilityChecks,
  isEligible,
  readyToLiveItems,
  readyToLiveScore,
  homeOfficeItems,
  workLocatedItems,
  tagHomeOffice,
  tagWorkLocated,
  tagCondoApproved,
  READY_TO_LIVE_THRESHOLD,
} from "@/lib/qualification";
import { INTERNET_TIERS, INTERNET_META, type InternetTier } from "@/lib/internet";
import { Button } from "@/components/ui/button";
import { ReadyToLiveBadge } from "@/components/ui/badge";
import { saveQualification } from "@/lib/data/actions";
import { cn } from "@/lib/utils";

const initialEligibility: EligibilityState = {
  furnished: false,
  accepts30days: false,
  iptuOk: false,
  habitable: false,
  isOwnerOrAgent: false,
  hasDocument: false,
  condoAllows: "", // neutro: nada pré-selecionado (N3)
};

const initialQuality: QualityState = {
  furnishedFull: false,
  kitchenEquipped: false,
  beddingTowels: false,
  appliancesOk: false,
  internetTier: "basica",
  climateControl: false,
  cleanConserved: false,
  hasHomeOffice: false,
  hasDesk: false,
  hasChair: false,
  coworking2km: false,
  meetingRoom: false,
  cafe1km: false,
};

export default function QualificationChecklistPage() {
  const router = useRouter();
  const [elig, setElig] = useState<EligibilityState>(initialEligibility);
  const [quality, setQuality] = useState<QualityState>(initialQuality);
  const [docName, setDocName] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  // Só mostra o veredito (APROVADO/NÃO ELEGÍVEL) depois da 1ª interação — evita
  // banner vermelho prematuro num onboarding ainda neutro (N3).
  const [hasInteracted, setHasInteracted] = useState(false);

  const eligible = isEligible(elig);
  const score = useMemo(() => readyToLiveScore(quality), [quality]);
  const baseBadge = score >= READY_TO_LIVE_THRESHOLD;
  const condoBlocked = elig.condoAllows === "no";

  const tHome = tagHomeOffice(quality);
  const tWork = tagWorkLocated(quality);
  const tCondo = tagCondoApproved(elig);

  function toggleElig(key: keyof EligibilityState) {
    setHasInteracted(true);
    setElig((s) => ({ ...s, [key]: !s[key as keyof EligibilityState] }));
  }
  function toggleQuality(key: keyof QualityState) {
    setQuality((s) => ({ ...s, [key]: !s[key] }));
  }

  async function save() {
    setSaving(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        "vivanomads-qualification",
        JSON.stringify({ eligible, score, baseBadge, tHome, tWork, tCondo })
      );
    }
    await saveQualification(elig, quality);
    setSaving(false);
    setSaved(true);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8">
        <p className="font-title text-sm font-bold uppercase tracking-wide text-blue-500">
          Porta de entrada do anúncio
        </p>
        <h1 className="mt-1 font-title text-3xl font-bold text-ink">Qualificação do imóvel</h1>
        <p className="mt-2 text-muted">
          A Camada 1 garante que isto é locação por temporada regular; a Camada 2 gera o selo{" "}
          <span className="font-medium text-forest">Pronto para Morar</span> e as etiquetas de
          especialização.
        </p>
      </header>

      {/* CAMADA 1 — ELEGIBILIDADE */}
      <section className="rounded-2xl border border-sage-200 bg-white p-6 sm:p-8">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-forest text-sm font-bold text-white">
            1
          </span>
          <h2 className="font-title text-xl font-bold text-ink">Elegibilidade</h2>
        </div>
        <p className="mt-2 text-sm text-muted">
          Itens obrigatórios. Se algum faltar, o imóvel não pode ser publicado.
        </p>

        <div className="mt-6 space-y-2">
          {/* Não exibe o item "Documentação enviada" como checkbox: ele é marcado
              automaticamente pelo campo de upload abaixo (evita confusão — item 4A). */}
          {eligibilityChecks(elig)
            .filter((c) => c.key !== "hasDocument")
            .map((c) => (
              <CheckRow
                key={c.key}
                checked={c.ok}
                label={c.label}
                onToggle={() => toggleElig(c.key as keyof EligibilityState)}
              />
            ))}

          <label
            className={cn(
              "flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-3 transition-colors",
              docName
                ? "border-sage bg-sage-100"
                : "border-sage-200 bg-surface-2 hover:border-sage"
            )}
          >
            <span className="flex items-center gap-3 text-sm">
              {docName ? (
                <CheckCircle2 className="h-5 w-5 text-forest" />
              ) : (
                <Upload className="h-5 w-5 text-sage" />
              )}
              <span>
                <span className="font-medium text-ink">
                  Documentação do imóvel{docName ? " — enviada ✓" : ""}
                </span>
                <span className="block text-xs text-muted">
                  {docName ?? "Matrícula ou contrato de gestão (PDF, JPG ou PNG)"}
                </span>
              </span>
            </span>
            <span className="rounded-full bg-forest px-3 py-1.5 text-xs font-medium text-white">
              {docName ? "Trocar" : "Enviar"}
            </span>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setHasInteracted(true);
                setDocName(f ? f.name : null);
                setElig((s) => ({ ...s, hasDocument: !!f }));
              }}
            />
          </label>
        </div>

        <fieldset className="mt-5">
          <legend className="text-sm font-medium text-ink">
            A convenção do condomínio permite locação por temporada?
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                { v: "yes", label: "Sim, permite" },
                { v: "unknown", label: "Não sei" },
                { v: "no", label: "Não, proíbe" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => {
                  setHasInteracted(true);
                  setElig((s) => ({ ...s, condoAllows: opt.v }));
                }}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                  elig.condoAllows === opt.v
                    ? "border-forest bg-forest text-white"
                    : "border-sage-200 bg-white text-ink hover:border-sage"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {condoBlocked && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Se a convenção proíbe a locação por temporada, o imóvel não pode ser anunciado.
            </p>
          )}
        </fieldset>

        <div
          className={cn(
            "mt-6 flex items-center gap-3 rounded-xl px-4 py-4",
            eligible ? "bg-sage-100" : hasInteracted ? "bg-red-50" : "bg-surface-2"
          )}
        >
          {eligible ? (
            <CheckCircle2 className="h-6 w-6 text-forest" />
          ) : hasInteracted ? (
            <XCircle className="h-6 w-6 text-red-600" />
          ) : (
            <Info className="h-6 w-6 text-blue-500" />
          )}
          <div>
            <p
              className={cn(
                "font-title font-bold",
                eligible ? "text-forest" : hasInteracted ? "text-red-700" : "text-ink"
              )}
            >
              {eligible
                ? "APROVADO PARA PUBLICAR"
                : hasInteracted
                  ? "NÃO ELEGÍVEL"
                  : "Vamos qualificar seu imóvel"}
            </p>
            <p className="text-sm text-muted">
              {eligible
                ? "Todos os requisitos foram atendidos."
                : hasInteracted
                  ? "Marque todos os itens obrigatórios e garanta que o condomínio não proíbe."
                  : "Marque os itens obrigatórios abaixo para liberar a publicação."}
            </p>
          </div>
        </div>
      </section>

      {/* CAMADA 2 — SELO BASE + ETIQUETAS */}
      <section className="mt-6 rounded-2xl border border-sage-200 bg-white p-6 sm:p-8">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-forest text-sm font-bold text-white">
            2
          </span>
          <h2 className="font-title text-xl font-bold text-ink">Selo Pronto para Morar + etiquetas</h2>
        </div>

        {/* Barra do selo base */}
        <div className="sticky top-4 z-10 mt-6 rounded-xl border border-sage-200 bg-white/95 p-4 backdrop-blur">
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-2">
              <Award className={cn("h-5 w-5", baseBadge ? "text-champagne-600" : "text-sage")} />
              <span className="font-title text-2xl font-bold text-forest">{score}</span>
              <span className="text-sm text-muted">/ 100</span>
            </div>
            {baseBadge && <ReadyToLiveBadge />}
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-sage-100">
            <div
              className="h-full rounded-full bg-champagne transition-all duration-300"
              style={{ width: `${score}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-muted">
            {baseBadge
              ? "Parabéns! Seu imóvel ganhou o selo Pronto para Morar e será bem ranqueado. 🏅"
              : `Some ${READY_TO_LIVE_THRESHOLD - score} ponto(s) para conquistar o selo Pronto para Morar.`}
          </p>
        </div>

        {/* Itens do selo base */}
        <div className="mt-6 space-y-2">
          {readyToLiveItems(quality).map((item) =>
            item.key === "internet" ? (
              <InternetTierRow
                key={item.key}
                value={quality.internetTier}
                pts={item.pts}
                on={item.on}
                onChange={(internetTier) => setQuality((s) => ({ ...s, internetTier }))}
              />
            ) : (
              <ScoreRow
                key={item.key}
                label={item.label}
                pts={item.pts}
                on={item.on}
                onToggle={() => toggleQuality(item.key as keyof QualityState)}
              />
            )
          )}
        </div>

        {/* Etiquetas */}
        <h3 className="mt-8 font-title font-bold text-ink">Etiquetas de especialização</h3>
        <p className="text-sm text-muted">Somam ao selo base e viram filtros na busca.</p>

        <TagBlock
          icon={Laptop}
          title="Para trabalhar de casa"
          earned={tHome}
          items={homeOfficeItems(quality)}
          onToggle={(label) => toggleQuality(homeKey(label))}
        />
        <TagBlock
          icon={MapPin}
          title="Bem localizado para trabalho"
          earned={tWork}
          items={workLocatedItems(quality)}
          onToggle={(label) => toggleQuality(workKey(label))}
        />
      </section>

      {/* Confirmação de salvamento (item 4B) */}
      {saved && (
        <div className="mt-6 flex items-center gap-2 rounded-xl border border-sage bg-sage-100 px-4 py-3 text-sm font-medium text-forest">
          <CheckCircle2 className="h-5 w-5" />
          Qualificação salva ✓ — selo e etiquetas registrados e prontos para o anúncio.
        </div>
      )}

      {/* AÇÃO */}
      <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          {eligible ? "Salve para liberar a publicação do anúncio." : "Conclua a Camada 1 para liberar a publicação."}
        </p>
        {saved ? (
          <Button variant="accent" onClick={() => router.push("/dashboard/imoveis/novo")}>
            Continuar para o anúncio <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button disabled={!eligible || saving} onClick={save}>
            {saving ? "Salvando..." : "Salvar qualificação"}
          </Button>
        )}
      </div>
    </div>
  );
}

function homeKey(label: string): keyof QualityState {
  const m: Record<string, keyof QualityState> = {
    "Cômodo/escritório dedicado": "hasHomeOffice",
    "Mesa de trabalho adequada": "hasDesk",
    "Cadeira de trabalho": "hasChair",
  };
  return m[label];
}
function workKey(label: string): keyof QualityState {
  const m: Record<string, keyof QualityState> = {
    "Coworking a menos de 2 km": "coworking2km",
    "Sala de reunião próxima": "meetingRoom",
    "Café de trabalho a menos de 1 km": "cafe1km",
  };
  return m[label];
}

function CheckRow({
  checked,
  label,
  onToggle,
  disabled,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
        checked ? "border-sage bg-sage-100" : "border-sage-200 bg-white hover:border-sage",
        disabled && "cursor-default opacity-90"
      )}
    >
      <span
        className={cn(
          "grid h-5 w-5 shrink-0 place-items-center rounded-md border",
          checked ? "border-forest bg-forest text-white" : "border-sage-200 bg-white"
        )}
      >
        {checked && <CheckCircle2 className="h-4 w-4" />}
      </span>
      <span className="text-sm text-ink">{label}</span>
    </button>
  );
}

function ScoreRow({
  label,
  pts,
  on,
  onToggle,
}: {
  label: string;
  pts: number;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
        on ? "border-champagne bg-champagne/10" : "border-sage-200 bg-white hover:border-sage"
      )}
    >
      <span className="flex items-center gap-3">
        <span
          className={cn(
            "grid h-5 w-5 shrink-0 place-items-center rounded-md border",
            on ? "border-champagne bg-champagne text-night" : "border-sage-200 bg-white"
          )}
        >
          {on && <CheckCircle2 className="h-4 w-4" />}
        </span>
        <span className="text-sm text-ink">{label}</span>
      </span>
      <span className={cn("shrink-0 text-sm font-semibold", on ? "text-champagne-600" : "text-muted")}>
        +{pts}
      </span>
    </button>
  );
}

/** Internet por categoria de uso (sem Mbps). >= trabalho remoto soma os pontos. */
function InternetTierRow({
  value,
  pts,
  on,
  onChange,
}: {
  value: InternetTier;
  pts: number;
  on: boolean;
  onChange: (tier: InternetTier) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 transition-colors",
        on ? "border-champagne bg-champagne/10" : "border-sage-200 bg-white"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-3">
          <span
            className={cn(
              "grid h-5 w-5 shrink-0 place-items-center rounded-md border",
              on ? "border-champagne bg-champagne text-night" : "border-sage-200 bg-white"
            )}
          >
            {on && <CheckCircle2 className="h-4 w-4" />}
          </span>
          <span className="text-sm text-ink">Internet que aguenta trabalho</span>
        </span>
        <span className={cn("shrink-0 text-sm font-semibold", on ? "text-champagne-600" : "text-muted")}>
          +{pts}
        </span>
      </div>
      <div className="ml-8 mt-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as InternetTier)}
          aria-label="Categoria da internet"
          className="w-full rounded-lg border border-sage-200 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sage"
        >
          {INTERNET_TIERS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-muted">{INTERNET_META[value].description}</p>
      </div>
    </div>
  );
}

function TagBlock({
  icon: Icon,
  title,
  earned,
  items,
  onToggle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  earned: boolean;
  items: { label: string; on: boolean; readonly?: boolean }[];
  onToggle: (label: string) => void;
}) {
  return (
    <div className="mt-4 rounded-xl border border-sage-200 p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-medium text-ink">
          <Icon className="h-5 w-5 text-sage" /> {title}
        </span>
        {earned ? (
          <span className="rounded-full bg-sage-100 px-2.5 py-1 text-xs font-medium text-sage">
            Etiqueta conquistada ✓
          </span>
        ) : (
          <span className="text-xs text-muted">Marque todos para conquistar</span>
        )}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {items.map((it) => {
          const readonly = "readonly" in it && it.readonly;
          return (
            <button
              key={it.label}
              type="button"
              role="checkbox"
              aria-checked={it.on}
              aria-label={it.label}
              onClick={() => !readonly && onToggle(it.label)}
              disabled={readonly}
              title={readonly ? "Definida pela categoria de internet no selo base" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                it.on ? "border-sage bg-sage-100 text-forest" : "border-sage-200 text-ink hover:border-sage",
                readonly && "cursor-default hover:border-sage-200"
              )}
            >
              <span
                className={cn(
                  "grid h-4 w-4 shrink-0 place-items-center rounded border",
                  it.on ? "border-forest bg-forest text-white" : "border-sage-200"
                )}
              >
                {it.on && <CheckCircle2 className="h-3 w-3" />}
              </span>
              {it.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
