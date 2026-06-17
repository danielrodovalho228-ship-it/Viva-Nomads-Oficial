"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  Upload,
  Award,
  Info,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import {
  type EligibilityState,
  type QualityState,
  eligibilityChecks,
  isEligible,
  scoreBreakdown,
  computeScore,
  WORK_READY_THRESHOLD,
} from "@/lib/qualification";
import { Button } from "@/components/ui/button";
import { WorkReadyBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const initialEligibility: EligibilityState = {
  furnished: false,
  accepts30days: false,
  iptuOk: false,
  habitable: false,
  isOwnerOrAgent: false,
  hasDocument: false,
  condoAllows: "unknown",
};

const initialQuality: QualityState = {
  hasHomeOffice: false,
  hasDesk: false,
  hasChair: false,
  internetFiber: false,
  internetMbps: 0,
  coworking2km: false,
  meetingRoom: false,
  cafe1km: false,
  washer: false,
  fullKitchen: false,
  acBedrooms: false,
  petsOk: false,
};

export default function QualificationChecklistPage() {
  const router = useRouter();
  const [elig, setElig] = useState<EligibilityState>(initialEligibility);
  const [quality, setQuality] = useState<QualityState>(initialQuality);
  const [docName, setDocName] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const eligible = isEligible(elig);
  const score = useMemo(() => computeScore(quality), [quality]);
  const workReady = score >= WORK_READY_THRESHOLD;
  const breakdown = useMemo(() => scoreBreakdown(quality), [quality]);
  const condoBlocked = elig.condoAllows === "no";

  function toggleElig(key: keyof EligibilityState) {
    setElig((s) => ({ ...s, [key]: !s[key as keyof EligibilityState] }));
  }

  function toggleQuality(key: keyof QualityState) {
    setQuality((s) => ({ ...s, [key]: !s[key] }));
  }

  function save() {
    // Em produção: grava em qualification_checklists (Supabase) com
    // eligible, work_score e status. Aqui registra a aprovação no fluxo demo.
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        "vivanomads-qualification",
        JSON.stringify({ eligible, score, workReady })
      );
    }
    setSaved(true);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <p className="font-title text-sm font-bold uppercase tracking-wide text-champagne-600">
          Porta de entrada do anúncio
        </p>
        <h1 className="mt-1 font-title text-3xl font-extrabold text-ink">
          Qualificação do imóvel
        </h1>
        <p className="mt-2 text-muted">
          Seu anúncio só é publicado depois de passar por esta qualificação. A Camada 1
          garante que isto é locação por temporada regular; a Camada 2 gera o selo{" "}
          <span className="font-medium text-forest">Pronto para Trabalho</span>.
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
          {eligibilityChecks(elig).map((c) => (
            <CheckRow
              key={c.key}
              checked={c.ok}
              label={c.label}
              onToggle={() => {
                if (c.key === "hasDocument") return; // controlado pelo upload
                toggleElig(c.key as keyof EligibilityState);
              }}
              disabled={c.key === "hasDocument"}
            />
          ))}

          {/* Upload de documento */}
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-sage-200 bg-surface-2 px-4 py-3 transition-colors hover:border-sage">
            <span className="flex items-center gap-3 text-sm">
              <Upload className="h-5 w-5 text-sage" />
              <span>
                <span className="font-medium text-ink">Documentação do imóvel</span>
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
                setDocName(f ? f.name : null);
                setElig((s) => ({ ...s, hasDocument: !!f }));
              }}
            />
          </label>
        </div>

        {/* Radio do condomínio */}
        <fieldset className="mt-5">
          <legend className="text-sm font-medium text-ink">
            A convenção do condomínio proíbe locação por temporada?
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                { v: "yes", label: "Não proíbe" },
                { v: "unknown", label: "Não sei" },
                { v: "no", label: "Sim, proíbe" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setElig((s) => ({ ...s, condoAllows: opt.v }))}
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
              Se a convenção proíbe expressamente a locação por temporada, o imóvel não pode
              ser anunciado. Verifique a convenção ou consulte o síndico antes de prosseguir.
            </p>
          )}
          {elig.condoAllows === "unknown" && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              Recomendamos confirmar na convenção do condomínio. Locação de 30+ dias com
              contrato costuma ser aceita, mas vale verificar.
            </p>
          )}
        </fieldset>

        {/* Status da Camada 1 */}
        <div
          className={cn(
            "mt-6 flex items-center gap-3 rounded-xl px-4 py-4",
            eligible ? "bg-sage-100" : "bg-red-50"
          )}
        >
          {eligible ? (
            <CheckCircle2 className="h-6 w-6 text-forest" />
          ) : (
            <XCircle className="h-6 w-6 text-red-600" />
          )}
          <div>
            <p
              className={cn(
                "font-title font-bold",
                eligible ? "text-forest" : "text-red-700"
              )}
            >
              {eligible ? "APROVADO PARA PUBLICAR" : "NÃO ELEGÍVEL"}
            </p>
            <p className="text-sm text-muted">
              {eligible
                ? "Todos os requisitos foram atendidos."
                : "Marque todos os itens obrigatórios e garanta que o condomínio não proíbe."}
            </p>
          </div>
        </div>
      </section>

      {/* CAMADA 2 — PONTUAÇÃO */}
      <section className="mt-6 rounded-2xl border border-sage-200 bg-white p-6 sm:p-8">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-forest text-sm font-bold text-white">
            2
          </span>
          <h2 className="font-title text-xl font-bold text-ink">
            Pontuação de qualidade
          </h2>
        </div>
        <p className="mt-2 text-sm text-muted">
          Não bloqueia o anúncio. A partir de {WORK_READY_THRESHOLD} pontos, o imóvel ganha o
          selo Pronto para Trabalho e pode cobrar mais.
        </p>

        {/* Barra de progresso dourada */}
        <div className="sticky top-4 z-10 mt-6 rounded-xl border border-sage-200 bg-white/95 p-4 backdrop-blur">
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-2">
              <Award className={cn("h-5 w-5", workReady ? "text-champagne" : "text-sage")} />
              <span className="font-title text-2xl font-extrabold text-forest">{score}</span>
              <span className="text-sm text-muted">/ 100 pontos</span>
            </div>
            {workReady && <WorkReadyBadge />}
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-sage-100">
            <div
              className="h-full rounded-full bg-champagne transition-all duration-300"
              style={{ width: `${score}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-muted">
            {workReady
              ? "Parabéns! Seu imóvel ganhou o selo Pronto para Trabalho. 🏆"
              : "Seu imóvel está elegível. Adicione mais recursos de trabalho para ganhar o selo Pronto para Trabalho e cobrar mais."}
          </p>
        </div>

        {/* Bloco A */}
        <ScoreBlock title="Espaço de trabalho no imóvel" max={50}>
          {breakdown.blockA.map((item) => (
            <ScoreRow
              key={item.label}
              {...item}
              onToggle={() => toggleQuality(mapQualityKey(item.label))}
            />
          ))}
          {quality.internetFiber && (
            <div className="ml-9 mt-1 flex items-center gap-2 text-sm">
              <span className="text-muted">Velocidade:</span>
              <input
                type="number"
                min={0}
                value={quality.internetMbps || ""}
                onChange={(e) =>
                  setQuality((s) => ({ ...s, internetMbps: Number(e.target.value) }))
                }
                className="w-24 rounded-lg border border-sage-200 px-2 py-1 outline-none focus:border-sage"
                placeholder="Mbps"
              />
              <span className="text-muted">Mbps</span>
            </div>
          )}
        </ScoreBlock>

        {/* Bloco B */}
        <ScoreBlock title="Espaços de trabalho próximos" max={30}>
          {breakdown.blockB.map((item) => (
            <ScoreRow
              key={item.label}
              {...item}
              onToggle={() => toggleQuality(mapQualityKey(item.label))}
            />
          ))}
        </ScoreBlock>

        {/* Bloco C */}
        <ScoreBlock title="Conforto para estadia longa" max={20}>
          {breakdown.blockC.map((item) => (
            <ScoreRow
              key={item.label}
              {...item}
              onToggle={() => toggleQuality(mapQualityKey(item.label))}
            />
          ))}
        </ScoreBlock>
      </section>

      {/* AÇÃO FINAL */}
      <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          {eligible
            ? "Tudo certo. Salve a qualificação para liberar a publicação do anúncio."
            : "Conclua a Camada 1 para liberar a publicação."}
        </p>
        {saved ? (
          <Button variant="gold" onClick={() => router.push("/dashboard/imoveis/novo")}>
            Continuar para o anúncio
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button disabled={!eligible} onClick={save}>
            Salvar qualificação
          </Button>
        )}
      </div>
    </div>
  );
}

/* Mapeia o label de cada item para a chave do estado de qualidade. */
function mapQualityKey(label: string): keyof QualityState {
  const map: Record<string, keyof QualityState> = {
    "Cômodo/escritório dedicado (home office)": "hasHomeOffice",
    "Mesa de trabalho adequada": "hasDesk",
    "Cadeira ergonômica ou de trabalho": "hasChair",
    "Internet fibra": "internetFiber",
    "Coworking a menos de 2 km": "coworking2km",
    "Sala de reunião no condomínio ou próxima": "meetingRoom",
    "Café/espaço de trabalho a menos de 1 km": "cafe1km",
    "Máquina de lavar no imóvel": "washer",
    "Cozinha completa equipada": "fullKitchen",
    "Ar-condicionado nos quartos": "acBedrooms",
    "Aceita pets": "petsOk",
  };
  return map[label];
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

function ScoreBlock({
  title,
  max,
  children,
}: {
  title: string;
  max: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-title font-bold text-ink">{title}</h3>
        <span className="text-xs font-medium text-muted">até {max} pts</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
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
            on ? "border-champagne bg-champagne text-forest" : "border-sage-200 bg-white"
          )}
        >
          {on && <CheckCircle2 className="h-4 w-4" />}
        </span>
        <span className="text-sm text-ink">{label}</span>
      </span>
      <span
        className={cn(
          "shrink-0 text-sm font-semibold",
          on ? "text-champagne-600" : "text-muted"
        )}
      >
        +{pts}
      </span>
    </button>
  );
}
