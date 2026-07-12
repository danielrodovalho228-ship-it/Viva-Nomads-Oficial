import type { Metadata } from "next";
import { Check, Percent, Camera, FileSignature, ShieldCheck, UserCheck, ClipboardList, Receipt, Banknote, PiggyBank } from "lucide-react";
import { PLANS } from "@/lib/constants";
import { PLANO_FUNDADOR } from "@/lib/flags";
import { CommissionCalculator } from "./commission-calculator";
import { ButtonLink } from "@/components/ui/button";
import { formatBRL, cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Planos",
  description:
    "Planos de assinatura para proprietários: Gratuito, Essencial e Profissional. Mais serviços opcionais como garantia, vistoria e fotografia.",
};

type ServiceTone = "incluido" | "avulso" | "cotacao" | "gratis";

interface Service {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  benefit: string;
  price: string;
  statusLabel: string;
  statusTone: "ok" | "partner";
  tone: ServiceTone;
  cta: string;
  href: string;
  highlight?: string;
}

/**
 * Serviços OPCIONAIS reais — cada um com STATUS honesto (Disponível / Via
 * parceiro) e separados por QUEM contrata. O botão não cobra aqui: leva ao
 * momento certo (reserva/contrato para o inquilino; anúncio para o
 * proprietário). A plataforma intermedia e documenta; nunca é a garantidora.
 * Caução e seguro-fiança são alternativas: por lei, só uma por contrato.
 */
const TENANT_SERVICES: Service[] = [
  { icon: ShieldCheck, title: "Seguro-fiança (sem depósito)", benefit: "Entre sem deixar dinheiro preso: uma taxa mensal diluída garante o aluguel, sem depósito de entrada. Contratada com parceiro, sujeita a análise.", price: "Orçamento sob análise", statusLabel: "Via parceiro", statusTone: "partner", tone: "cotacao", cta: "Ver opções de garantia", href: "/como-funciona#garantias", highlight: "Recomendada · sem depósito" },
  { icon: PiggyBank, title: "Caução (depósito devolvível)", benefit: "Depósito devolvível em conta vinculada — conta bancária conjunta (proprietário + inquilino), à qual a plataforma não tem acesso —, nos termos do contrato e da Lei 8.245/91, devolvido ao fim da estadia.", price: "Sem mensalidade", statusLabel: "Disponível", statusTone: "ok", tone: "avulso", cta: "Ver opções de garantia", href: "/como-funciona#garantias" },
];

const OWNER_SERVICES: Service[] = [
  { icon: ClipboardList, title: "Vistoria documentada (entrada e saída)", benefit: "Inspeção imparcial do imóvel, com laudo em PDF, fotos e inventário da mobília. Ideal para quem acompanha o imóvel à distância.", price: "Sob consulta", statusLabel: "Disponível via parceiro", statusTone: "partner", tone: "avulso", cta: "Solicitar vistoria", href: "/dashboard/fechamento", highlight: "Ideal para proprietário à distância" },
  { icon: Camera, title: "Fotografia profissional", benefit: "Sessão de fotos do imóvel para anúncios que convertem mais.", price: "Sob consulta", statusLabel: "Via parceiro", statusTone: "partner", tone: "avulso", cta: "Adicionar ao anúncio", href: "/dashboard/imoveis/novo" },
];

/**
 * Tecnologia & segurança — recursos que já vêm por baixo (o cliente nunca
 * contrata o fornecedor). Aparecem como BENEFÍCIO, sem nome de fornecedor.
 */
const TECH_BENEFITS = [
  { icon: FileSignature, title: "Contrato assinado digitalmente", text: "Contrato de locação por temporada com validade jurídica." },
  { icon: UserCheck, title: "Inquilino verificado", text: "Identidade e perfil confirmados antes de fechar o aluguel." },
  { icon: Banknote, title: "Aluguel direto na conta do proprietário", text: "O pagamento do aluguel vai direto ao proprietário." },
  { icon: Receipt, title: "Nota fiscal disponível", text: "Emissão da nota fiscal do aluguel conforme a legislação." },
] as const;

const ICON_TONE: Record<ServiceTone, string> = {
  incluido: "bg-champagne/15 text-champagne-600",
  cotacao: "bg-sage-100 text-forest",
  avulso: "bg-sage-100 text-forest",
  gratis: "bg-blue-50 text-blue-500",
};

const STATUS_TONE = {
  ok: "bg-green-50 text-green-900",
  partner: "bg-amber-50 text-amber-700",
} as const;

function ServiceCard({ s }: { s: Service }) {
  const Icon = s.icon;
  const included = s.tone === "incluido";
  const highlight = s.highlight ?? null;
  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-2xl border bg-white p-6 transition-all hover:-translate-y-0.5 hover:shadow-md",
        included
          ? "border-champagne ring-1 ring-champagne/40"
          : highlight
            ? "border-blue-200 ring-1 ring-blue-100"
            : "border-sage-200"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={cn("grid h-12 w-12 place-items-center rounded-xl", ICON_TONE[s.tone])}>
          <Icon className="h-6 w-6" aria-hidden />
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
            STATUS_TONE[s.statusTone]
          )}
        >
          {s.statusLabel}
        </span>
      </div>
      <h3 className="mt-4 font-title text-lg font-bold text-ink">{s.title}</h3>
      {included && (
        <span className="mt-2 inline-flex w-fit items-center rounded-full bg-champagne px-2.5 py-0.5 text-xs font-semibold text-forest">
          Incluído no plano Profissional
        </span>
      )}
      {highlight && (
        <span className="mt-2 inline-flex w-fit items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
          {highlight}
        </span>
      )}
      <p className="mt-2 flex-1 text-sm text-muted">{s.benefit}</p>
      <div className="mt-5 flex items-center justify-between gap-3">
        <span className={cn("text-sm font-semibold", included ? "text-champagne-600" : "text-ink")}>
          {s.price}
        </span>
        {included ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-champagne px-3 py-1.5 text-sm font-medium text-champagne-600">
            <Check className="h-4 w-4" aria-hidden /> Incluído
          </span>
        ) : (
          <ButtonLink href={s.href} variant={s.tone === "gratis" ? "outline" : "primary"} size="sm">
            {s.cta}
          </ButtonLink>
        )}
      </div>
    </div>
  );
}

export default function PricingPage() {
  return (
    <>
      {PLANO_FUNDADOR && (
        <div className="border-b border-champagne/40 bg-champagne/15">
          <div className="container-page flex flex-wrap items-center justify-center gap-x-2 gap-y-1 py-3 text-center text-sm text-ink">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-forest px-2.5 py-0.5 text-xs font-bold text-white">
              Piloto Fundador
            </span>
            <span>
              Assinatura <strong>gratuita por 12 meses</strong> para os 20 primeiros proprietários,
              com todos os recursos do plano <strong>Profissional</strong>. Comissão de fechamento
              normal (8%). Fundadores mantêm <strong>20% de desconto vitalício</strong> quando a
              cobrança começar.
            </span>
          </div>
        </div>
      )}

      <section className="bg-forest section-y text-center text-white">
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

              {/* O que você paga — custo (comissão), separado dos benefícios e
                  sem check verde, para não disfarçar custo de benefício. */}
              {plan.cost && (
                <div className="mt-5 border-t border-sage-200 pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">
                    O que você paga
                  </p>
                  <p className="mt-1.5 flex items-start gap-2.5 rounded-lg bg-surface-2 px-2.5 py-2 text-sm text-muted">
                    <Percent className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /> {plan.cost}
                  </p>
                </div>
              )}

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

      {/* Serviços opcionais — reais, com preço e separados por quem contrata */}
      <section className="bg-surface-2 section-y">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-title text-3xl font-bold text-ink">Serviços opcionais</h2>
            <p className="mt-4 text-muted">
              Reforce o anúncio e organize a negociação. Cada serviço mostra o preço e o status —
              o que já funciona e o que depende de parceiro. A contratação acontece no momento
              certo do fluxo; aqui é só transparência.
            </p>
            <p className="mx-auto mt-3 max-w-xl rounded-lg bg-white px-3 py-2 text-sm text-muted">
              <strong className="text-ink">Garantia, do seu jeito:</strong> escolha entre taxa
              mensal sem depósito (seguro-fiança) ou caução devolvível. Por lei, só uma
              garantia por contrato. A plataforma organiza e documenta; não é a garantidora.
            </p>
          </div>

          <div className="mt-10">
            <h3 className="font-title text-sm font-bold uppercase tracking-wide text-muted">
              Para o inquilino
            </h3>
            <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {TENANT_SERVICES.map((s) => (
                <ServiceCard key={s.title} s={s} />
              ))}
            </div>
          </div>

          <div className="mt-10">
            <h3 className="font-title text-sm font-bold uppercase tracking-wide text-muted">
              Para o proprietário
            </h3>
            <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {OWNER_SERVICES.map((s) => (
                <ServiceCard key={s.title} s={s} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Tecnologia & segurança — vêm por baixo, sem nome de fornecedor */}
      <section className="section-y">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-title text-2xl font-bold text-ink">Tecnologia &amp; segurança</h2>
            <p className="mt-3 text-muted">
              Recursos que já acompanham toda locação — você não contrata nada à parte.
            </p>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {TECH_BENEFITS.map((b) => {
              const Icon = b.icon;
              return (
                <div key={b.title} className="rounded-2xl border border-sage-200 bg-white p-5">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-sage-100 text-forest">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="mt-3 font-title text-base font-bold text-ink">{b.title}</h3>
                  <p className="mt-1.5 text-sm text-muted">{b.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
