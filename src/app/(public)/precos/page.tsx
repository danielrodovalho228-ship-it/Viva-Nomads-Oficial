import type { Metadata } from "next";
import { Check, Camera, FileSignature, BrainCircuit, BadgeCheck } from "lucide-react";
import { PLANS } from "@/lib/constants";
import { CommissionCalculator } from "./commission-calculator";
import { ButtonLink } from "@/components/ui/button";
import { formatBRL, cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Planos e preços",
  description:
    "Planos de assinatura para proprietários: Gratuito, Essencial e Profissional. Mais serviços opcionais como fotografia, contrato e análise de inquilino.",
};

const ADDONS = [
  { icon: Camera, title: "Fotografia profissional", text: "Sessão de fotos do imóvel para anúncios que convertem mais." },
  { icon: FileSignature, title: "Contrato via ZapSign", text: "Contrato de temporada gerado e assinado digitalmente, com validade jurídica." },
  { icon: BrainCircuit, title: "Verificação de identidade do inquilino", text: "Laudo com semáforo de risco: identidade, prova de vida e histórico." },
  { icon: BadgeCheck, title: "Selo de verificação", text: "Destaque de proprietário verificado para gerar mais confiança." },
];

export default function PricingPage() {
  return (
    <>
      <section className="bg-forest py-16 text-center text-white md:py-20">
        <div className="container-page">
          <h1 className="font-title text-4xl font-bold md:text-5xl">Anuncie de graça</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-white/80">
            Você só paga uma comissão <strong className="text-white">quando fechar</strong> — e
            ela cai conforme seu plano. A assinatura é opcional e vira economia para quem fecha
            mais. O pagamento do aluguel vai direto ao proprietário.
          </p>
        </div>
      </section>

      <section className="container-page -mt-10 pb-16">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                "flex flex-col rounded-3xl border bg-white p-8",
                plan.featured
                  ? "border-champagne shadow-xl ring-2 ring-champagne"
                  : "border-sage-200 shadow-sm"
              )}
            >
              {plan.featured && (
                <span className="mb-4 inline-flex w-fit items-center rounded-full bg-champagne px-3 py-1 text-xs font-semibold text-forest">
                  Mais popular
                </span>
              )}
              <h3 className="font-title text-2xl font-bold text-ink">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted">{plan.tagline}</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="font-title text-4xl font-bold text-forest">
                  {plan.price === null
                    ? "Sob consulta"
                    : plan.price === 0
                      ? "Grátis"
                      : formatBRL(plan.price)}
                </span>
                {!!plan.price && <span className="text-muted">/mês</span>}
              </div>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-ink">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-sage" /> {f}
                  </li>
                ))}
              </ul>

              <ButtonLink
                href="/dashboard/assinatura"
                variant={plan.featured ? "gold" : "outline"}
                className="mt-8 w-full"
              >
                {plan.cta}
              </ButtonLink>
            </div>
          ))}
        </div>

        {/* Calculadora — conta pronta (clareza de preço) */}
        <div className="mt-12">
          <CommissionCalculator />
        </div>
      </section>

      {/* Serviços opcionais */}
      <section className="bg-surface-2 py-16">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-title text-3xl font-bold text-ink">Serviços opcionais</h2>
            <p className="mt-4 text-muted">
              Pague apenas pelo que usar — disponíveis em qualquer plano.
            </p>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {ADDONS.map((a) => {
              const Icon = a.icon;
              return (
                <div key={a.title} className="rounded-2xl border border-sage-200 bg-white p-6">
                  <Icon className="h-7 w-7 text-champagne-600" />
                  <h3 className="mt-4 font-title text-base font-bold text-ink">{a.title}</h3>
                  <p className="mt-2 text-sm text-muted">{a.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
