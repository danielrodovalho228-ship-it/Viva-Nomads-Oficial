"use client";

import { useMemo, useState } from "react";
import {
  ShieldCheck,
  Check,
  ArrowRight,
  ArrowLeft,
  Fingerprint,
  ScanFace,
  FileCheck2,
  Lock,
  FileSignature,
  Sparkles,
  Globe2,
} from "lucide-react";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { PlatformLegalNotice, OwnerDecisionNotice } from "@/components/legal-notice";
import {
  GUARANTEE_OPTIONS,
  INSURERS,
  COST_SPLIT_ITEMS,
  TRAFFIC_LIGHT_META,
  simulateQuote,
  type GuaranteeType,
  type Insurer,
  type CafResult,
  type CostParty,
} from "@/lib/closing";
import { formatBRL, cn } from "@/lib/utils";

const STEPS = ["Candidatura & CAF", "Garantia", "Cotação", "Patrimonial", "Contrato", "Resumo"];

// Inquilino e imóvel da candidatura (mock — viria do lead selecionado).
const TENANT = { name: "Ana Carvalho", profile: "Médica · residência", foreigner: false };
const PROPERTY = { title: "Apto mobiliado · Santa Mônica", monthlyRent: 3200, term: 12 };

const CAF_RESULT: CafResult = {
  light: "green",
  identity: true,
  liveness: true,
  document: true,
  coversForeigners: true,
  notes: ["Identidade confirmada", "Prova de vida aprovada", "Sem execuções fiscais relevantes"],
};

export default function ClosingPage() {
  const [step, setStep] = useState(0);
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [guarantee, setGuarantee] = useState<GuaranteeType | null>(null);
  const [insurer, setInsurer] = useState<Insurer | null>(null);
  const [patrimonial, setPatrimonial] = useState<boolean | null>(null);
  const [split, setSplit] = useState<Record<string, CostParty>>(
    Object.fromEntries(COST_SPLIT_ITEMS.map((i) => [i.key, i.default]))
  );
  const [generated, setGenerated] = useState(false);

  const quote = useMemo(
    () => (insurer ? simulateQuote(insurer, PROPERTY.monthlyRent) : null),
    [insurer]
  );

  // Pula a etapa de cotação quando a garantia não é seguro-fiança.
  function next() {
    setStep((s) => {
      const skipQuote = s === 1 && guarantee !== "seguro_fianca";
      return Math.min(STEPS.length - 1, s + (skipQuote ? 2 : 1));
    });
  }
  function back() {
    setStep((s) => {
      const skipQuote = s === 3 && guarantee !== "seguro_fianca";
      return Math.max(0, s - (skipQuote ? 2 : 1));
    });
  }

  function runVerification() {
    setVerifying(true);
    setTimeout(() => {
      setVerifying(false);
      setVerified(true);
    }, 1100);
  }

  const canAdvance =
    (step === 0 && verified) ||
    (step === 1 && !!guarantee) ||
    (step === 2 && !!insurer) ||
    (step === 3 && patrimonial !== null) ||
    step === 4;

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle
        title="Fechamento"
        subtitle={`${TENANT.name} → ${PROPERTY.title}`}
      />

      {/* Stepper */}
      <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={cn(
              "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm whitespace-nowrap",
              i === step
                ? "bg-forest text-white"
                : i < step
                  ? "bg-sage-100 text-forest"
                  : "bg-surface-2 text-muted"
            )}
          >
            {i < step ? <Check className="h-4 w-4" /> : <span>{i + 1}</span>}
            {s}
          </div>
        ))}
      </div>

      <Panel>
        {/* ── 8.1 CANDIDATURA + VERIFICAÇÃO CAF ── */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-title text-lg font-bold text-ink">Candidatura e verificação</h2>
              <p className="mt-1 text-sm text-muted">
                {TENANT.name} · {TENANT.profile}
              </p>
            </div>

            {!verified ? (
              <div className="rounded-xl border border-sage-200 p-5 text-center">
                <ShieldCheck className="mx-auto h-10 w-10 text-sage" />
                <p className="mt-3 text-sm text-muted">
                  Verificação CAF: identidade, documento (OCR), prova de vida (biometria) e
                  risco contextual. Cobre estrangeiros (CRNM/RNE).
                </p>
                <Button variant="gold" className="mt-4" onClick={runVerification} disabled={verifying}>
                  {verifying ? "Verificando..." : "Disparar verificação CAF"}
                </Button>
              </div>
            ) : (
              <CafLaudo result={CAF_RESULT} />
            )}

            <OwnerDecisionNotice />
          </div>
        )}

        {/* ── 8.2 ESCOLHA DE GARANTIA (única) ── */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="font-title text-lg font-bold text-ink">Garantia locatícia</h2>
              <p className="mt-1 text-sm text-muted">
                Escolha <strong>uma</strong> garantia. Garantia dupla é nula por lei (art. 42
                da Lei 8.245/91).
              </p>
            </div>
            <div className="space-y-3">
              {GUARANTEE_OPTIONS.map((g) => {
                const active = guarantee === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGuarantee(g.id)}
                    className={cn(
                      "w-full rounded-xl border-2 p-4 text-left transition-colors",
                      active ? "border-forest bg-sage-100" : "border-sage-200 hover:border-sage"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 font-title font-bold text-ink">
                        {g.name}
                        {g.recommended && (
                          <span className="rounded-full bg-champagne px-2 py-0.5 text-xs font-semibold text-forest">
                            Recomendado
                          </span>
                        )}
                      </span>
                      <span
                        className={cn(
                          "grid h-5 w-5 place-items-center rounded-full border",
                          active ? "border-forest bg-forest text-white" : "border-sage-200"
                        )}
                      >
                        {active && <Check className="h-3.5 w-3.5" />}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted">{g.summary}</p>
                  </button>
                );
              })}
            </div>
            {guarantee && (
              <p className="rounded-lg bg-sage-100 px-3 py-2 text-xs text-forest">
                Garantia selecionada: <strong>{GUARANTEE_OPTIONS.find((g) => g.id === guarantee)?.name}</strong>.
                As demais ficam bloqueadas — só uma é válida no contrato.
              </p>
            )}
          </div>
        )}

        {/* ── 8.3 COTAÇÃO DE SEGURO-FIANÇA ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="font-title text-lg font-bold text-ink">Cotação de seguro-fiança</h2>
              <p className="mt-1 text-sm text-muted">
                Cotação dentro da plataforma, com seguradora parceira. A plataforma recebe
                comissão por apólice emitida.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {INSURERS.map((ins) => {
                const active = insurer === ins.id;
                const q = simulateQuote(ins.id, PROPERTY.monthlyRent);
                return (
                  <button
                    key={ins.id}
                    type="button"
                    onClick={() => setInsurer(ins.id)}
                    className={cn(
                      "rounded-xl border-2 p-4 text-left transition-colors",
                      active ? "border-forest bg-sage-100" : "border-sage-200 hover:border-sage"
                    )}
                  >
                    <p className="font-title font-bold text-ink">{ins.name}</p>
                    <p className="text-xs text-muted">{ins.note}</p>
                    <p className="mt-3 font-title text-xl font-extrabold text-forest">
                      {formatBRL(q.monthlyInstallment)}
                      <span className="text-sm font-normal text-muted">/mês</span>
                    </p>
                    <p className="text-xs text-muted">
                      Cobertura até {formatBRL(q.coverage)}
                    </p>
                  </button>
                );
              })}
            </div>
            {quote && (
              <div className="rounded-xl bg-surface-2 p-4 text-sm text-ink">
                Custo anual aproximado: <strong>{formatBRL(quote.annualCost)}</strong> (parcelável).
                Beneficiário: o proprietário.
              </div>
            )}
          </div>
        )}

        {/* ── 8.4 SEGURO PATRIMONIAL (opcional) ── */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="font-title text-lg font-bold text-ink">Seguro patrimonial</h2>
              <p className="mt-1 text-sm text-muted">
                Cobre incêndio e danos ao imóvel. <strong>Opcional</strong> — recomendado, não
                obrigatório.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPatrimonial(true)}
                className={cn(
                  "rounded-xl border-2 p-4 text-left transition-colors",
                  patrimonial === true ? "border-forest bg-sage-100" : "border-sage-200 hover:border-sage"
                )}
              >
                <p className="font-title font-bold text-ink">Adicionar com parceiro</p>
                <p className="mt-1 text-sm text-muted">Contratar seguro patrimonial via seguradora parceira.</p>
              </button>
              <button
                type="button"
                onClick={() => setPatrimonial(false)}
                className={cn(
                  "rounded-xl border-2 p-4 text-left transition-colors",
                  patrimonial === false ? "border-forest bg-sage-100" : "border-sage-200 hover:border-sage"
                )}
              >
                <p className="font-title font-bold text-ink">Seguir sem seguro patrimonial</p>
                <p className="mt-1 text-sm text-muted">Pode contratar depois, a qualquer momento.</p>
              </button>
            </div>
          </div>
        )}

        {/* ── 8.5 CONTRATO ZAPSIGN + RATEIO ── */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-title text-lg font-bold text-ink">Contrato de locação por temporada</h2>
              <p className="mt-1 text-sm text-muted">
                Gerado e assinado via ZapSign (validade jurídica · Lei 14.063/2020), art. 48
                da Lei 8.245/91.
              </p>
            </div>

            {/* Rateio de custos */}
            <div>
              <h3 className="mb-2 text-sm font-medium text-ink">
                Rateio de custos durante a estadia
              </h3>
              <div className="space-y-2">
                {COST_SPLIT_ITEMS.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between rounded-xl border border-sage-200 px-4 py-2.5"
                  >
                    <span className="text-sm text-ink">{item.label}</span>
                    <div className="flex rounded-full bg-surface-2 p-0.5 text-xs">
                      {(["owner", "tenant"] as const).map((party) => (
                        <button
                          key={party}
                          type="button"
                          onClick={() => setSplit((s) => ({ ...s, [item.key]: party }))}
                          className={cn(
                            "rounded-full px-3 py-1 font-medium transition-colors",
                            split[item.key] === party
                              ? "bg-forest text-white"
                              : "text-muted"
                          )}
                        >
                          {party === "owner" ? "Proprietário" : "Inquilino"}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Resumo de campos dinâmicos do contrato */}
            <div className="rounded-xl bg-surface-2 p-4 text-sm">
              <Row label="Inquilino" value={TENANT.name} />
              <Row label="Imóvel" value={PROPERTY.title} />
              <Row label="Prazo" value={`${PROPERTY.term} meses`} />
              <Row label="Aluguel" value={`${formatBRL(PROPERTY.monthlyRent)}/mês`} />
              <Row
                label="Garantia"
                value={GUARANTEE_OPTIONS.find((g) => g.id === guarantee)?.name ?? "—"}
              />
            </div>

            {generated ? (
              <div className="flex items-center gap-2 rounded-xl bg-sage-100 px-4 py-3 text-sm text-forest">
                <FileCheck2 className="h-5 w-5" /> Contrato enviado para assinatura via ZapSign.
              </div>
            ) : (
              <Button variant="gold" onClick={() => setGenerated(true)}>
                <FileSignature className="h-4 w-4" /> Gerar contrato no ZapSign
              </Button>
            )}
          </div>
        )}

        {/* ── RESUMO FINAL ── */}
        {step === 5 && (
          <div className="space-y-5 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-sage-100">
              <Sparkles className="h-7 w-7 text-forest" />
            </div>
            <div>
              <h2 className="font-title text-xl font-bold text-ink">Fechamento concluído</h2>
              <p className="mx-auto mt-2 max-w-md text-muted">
                Verificação, garantia e contrato organizados. O pagamento do aluguel segue
                direto ao proprietário.
              </p>
            </div>
            <div className="rounded-xl bg-surface-2 p-4 text-left text-sm">
              <Row label="Inquilino verificado" value={`${TRAFFIC_LIGHT_META[CAF_RESULT.light].emoji} ${TRAFFIC_LIGHT_META[CAF_RESULT.light].label}`} />
              <Row label="Garantia" value={GUARANTEE_OPTIONS.find((g) => g.id === guarantee)?.name ?? "—"} />
              {insurer && <Row label="Seguradora" value={INSURERS.find((i) => i.id === insurer)?.name ?? "—"} />}
              <Row label="Seguro patrimonial" value={patrimonial ? "Contratado" : "Não contratado"} />
              <Row label="Contrato" value={generated ? "Enviado (ZapSign)" : "Pendente"} />
            </div>
            <PlatformLegalNotice className="text-left" />
          </div>
        )}

        {/* Navegação */}
        {step < 5 && (
          <div className="mt-6 flex justify-between">
            <Button variant="ghost" onClick={back} disabled={step === 0}>
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            <Button onClick={next} disabled={!canAdvance}>
              Continuar <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </Panel>

      {step < 5 && <PlatformLegalNotice className="mt-4" />}
    </div>
  );
}

function CafLaudo({ result }: { result: CafResult }) {
  const meta = TRAFFIC_LIGHT_META[result.light];
  return (
    <div className={cn("rounded-xl p-5 ring-1", meta.tone, meta.ring)}>
      <div className="flex items-center gap-2">
        <span className="text-2xl">{meta.emoji}</span>
        <span className="font-title text-lg font-bold">Laudo CAF — {meta.label}</span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <LaudoItem icon={Fingerprint} label="Identidade" ok={result.identity} />
        <LaudoItem icon={ScanFace} label="Prova de vida" ok={result.liveness} />
        <LaudoItem icon={FileCheck2} label="Documento (OCR)" ok={result.document} />
      </div>
      <ul className="mt-4 space-y-1 text-sm">
        {result.notes.map((n) => (
          <li key={n} className="flex items-center gap-2">
            <Check className="h-4 w-4" /> {n}
          </li>
        ))}
      </ul>
      {result.coversForeigners && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs">
          <Globe2 className="h-3.5 w-3.5" /> Cobre estrangeiros (CRNM/RNE)
        </p>
      )}
    </div>
  );
}

function LaudoItem({
  icon: Icon,
  label,
  ok,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-white/60 px-3 py-2 text-sm">
      <Icon className="h-4 w-4" />
      <span className="flex-1">{label}</span>
      {ok ? <Check className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}
