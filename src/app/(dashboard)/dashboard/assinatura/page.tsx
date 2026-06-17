"use client";

import { useState } from "react";
import { Check, QrCode, Barcode, CreditCard, Copy, Loader2 } from "lucide-react";
import { PLANS } from "@/lib/constants";
import { useAuthStore } from "@/lib/store";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { formatBRL, cn } from "@/lib/utils";

type Billing = "PIX" | "BOLETO" | "CREDIT_CARD";

interface SubResult {
  demo: boolean;
  subscriptionId: string;
  pixPayload?: string;
  invoiceUrl?: string;
  status: string;
}

const BILLING: { id: Billing; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "PIX", label: "PIX", icon: QrCode },
  { id: "BOLETO", label: "Boleto", icon: Barcode },
  { id: "CREDIT_CARD", label: "Cartão", icon: CreditCard },
];

export default function SubscriptionPage() {
  const user = useAuthStore((s) => s.user);
  const currentPlanId = "free";
  const [selected, setSelected] = useState<string | null>(null);
  const [billing, setBilling] = useState<Billing>("PIX");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SubResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function subscribe(planId: string) {
    setSelected(planId);
    setResult(null);
    setError(null);
  }

  async function confirm() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/assinatura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selected,
          billingType: billing,
          name: user?.name,
          email: user?.email,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao assinar.");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageTitle title="Assinatura" subtitle="Gerencie seu plano e a forma de pagamento." />

      <Panel className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Plano atual</p>
          <p className="font-title text-xl font-bold text-ink">Gratuito</p>
          <p className="text-sm text-muted">1 anúncio ativo · sem cobrança</p>
        </div>
        <span className="rounded-full bg-sage-100 px-3 py-1.5 text-sm font-medium text-forest">
          Pagamento nativo: PIX · Boleto · Cartão
        </span>
      </Panel>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => {
          const current = plan.id === currentPlanId;
          const isSelected = selected === plan.id;
          const isCustom = plan.price === null;
          return (
            <div
              key={plan.id}
              className={cn(
                "flex flex-col rounded-2xl border bg-white p-6",
                isSelected
                  ? "border-forest ring-2 ring-forest"
                  : plan.featured
                    ? "border-champagne ring-1 ring-champagne"
                    : "border-sage-200"
              )}
            >
              <h3 className="font-title text-lg font-bold text-ink">{plan.name}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="font-title text-3xl font-extrabold text-forest">
                  {isCustom ? "Sob consulta" : plan.price === 0 ? "Grátis" : formatBRL(plan.price)}
                </span>
                {!!plan.price && <span className="text-sm text-muted">/mês</span>}
              </div>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {plan.features.slice(0, 4).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-ink">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-sage" /> {f}
                  </li>
                ))}
              </ul>
              <Button
                variant={current ? "outline" : plan.featured ? "gold" : "primary"}
                className="mt-5 w-full"
                disabled={current || plan.price === 0 || isCustom}
                onClick={() => subscribe(plan.id)}
              >
                {current
                  ? "Plano atual"
                  : isCustom
                    ? plan.cta
                    : plan.price === 0
                      ? "Plano gratuito"
                      : plan.cta}
              </Button>
            </div>
          );
        })}
      </div>

      {/* Forma de pagamento */}
      {selected && (
        <Panel className="mt-6" title="Forma de pagamento">
          <div className="flex flex-wrap gap-2">
            {BILLING.map((b) => {
              const Icon = b.icon;
              return (
                <button
                  key={b.id}
                  onClick={() => setBilling(b.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                    billing === b.id
                      ? "border-forest bg-forest text-white"
                      : "border-sage-200 text-ink hover:border-sage"
                  )}
                >
                  <Icon className="h-4 w-4" /> {b.label}
                </button>
              );
            })}
          </div>

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          {!result ? (
            <Button variant="gold" className="mt-5" onClick={confirm} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Assinar {PLANS.find((p) => p.id === selected)?.name} via {billing === "CREDIT_CARD" ? "cartão" : billing.toLowerCase()}
            </Button>
          ) : (
            <PaymentResult result={result} billing={billing} />
          )}
        </Panel>
      )}

      <p className="mt-6 text-sm text-muted">
        Cada plano define o limite de anúncios ativos. O pagamento do aluguel é feito direto ao
        proprietário — a assinatura cobre apenas o uso da plataforma.
      </p>
    </>
  );
}

function PaymentResult({ result, billing }: { result: SubResult; billing: Billing }) {
  return (
    <div className="mt-5 rounded-xl border border-sage-200 bg-surface-2 p-5">
      <div className="flex items-center gap-2 text-forest">
        <Check className="h-5 w-5" />
        <span className="font-medium">
          Assinatura criada {result.demo && "(modo demonstração)"} · status {result.status}
        </span>
      </div>

      {billing === "PIX" && result.pixPayload && (
        <div className="mt-4">
          <p className="text-sm text-muted">PIX copia-e-cola:</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg bg-white px-3 py-2 text-xs text-ink">
              {result.pixPayload}
            </code>
            <button
              onClick={() => navigator.clipboard?.writeText(result.pixPayload!)}
              className="grid h-9 w-9 place-items-center rounded-lg bg-forest text-white"
              aria-label="Copiar código PIX"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {billing !== "PIX" && (
        <a
          href={result.invoiceUrl ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-forest px-4 py-2 text-sm font-medium text-white"
        >
          {billing === "BOLETO" ? "Abrir boleto" : "Pagar com cartão"}
        </a>
      )}
    </div>
  );
}
