"use client";

import { Check, CreditCard } from "lucide-react";
import { PLANS } from "@/lib/constants";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { formatBRL, cn } from "@/lib/utils";

export default function SubscriptionPage() {
  const currentPlanId = "free"; // viria do Supabase/Stripe

  function startCheckout(planId: string) {
    // Em produção: chama a rota que cria a sessão do Stripe Checkout (modo subscription).
    alert(
      `Stripe Checkout (modo teste) para o plano "${planId}". Configure STRIPE_SECRET_KEY para ativar.`
    );
  }

  return (
    <>
      <PageTitle
        title="Assinatura"
        subtitle="Gerencie seu plano e os serviços da plataforma."
      />

      <Panel className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Plano atual</p>
          <p className="font-title text-xl font-bold text-ink">Gratuito</p>
          <p className="text-sm text-muted">1 anúncio ativo · sem cobrança</p>
        </div>
        <Button variant="outline">
          <CreditCard className="h-4 w-4" /> Portal de cobrança
        </Button>
      </Panel>

      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => {
          const current = plan.id === currentPlanId;
          return (
            <div
              key={plan.id}
              className={cn(
                "flex flex-col rounded-2xl border bg-white p-6",
                plan.featured ? "border-champagne ring-1 ring-champagne" : "border-sage-200"
              )}
            >
              <h3 className="font-title text-lg font-bold text-ink">{plan.name}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="font-title text-3xl font-extrabold text-forest">
                  {plan.price === 0 ? "Grátis" : formatBRL(plan.price)}
                </span>
                {plan.price > 0 && <span className="text-sm text-muted">/mês</span>}
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
                disabled={current}
                onClick={() => startCheckout(plan.id)}
              >
                {current ? "Plano atual" : plan.cta}
              </Button>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-sm text-muted">
        Cada plano define o limite de anúncios ativos. O pagamento do aluguel é feito direto ao
        proprietário — a assinatura cobre apenas o uso da plataforma.
      </p>
    </>
  );
}
