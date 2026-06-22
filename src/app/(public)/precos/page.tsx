import type { Metadata } from "next";
import { Check, Percent, Camera, FileSignature, ShieldCheck, UserCheck, ClipboardList, Receipt, Calculator, PiggyBank } from "lucide-react";
import { PLANS } from "@/lib/constants";
import { CommissionCalculator } from "./commission-calculator";
import { ButtonLink } from "@/components/ui/button";
import { formatBRL, cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Planos",
  description:
    "Planos de assinatura para proprietários: Gratuito, Essencial e Profissional. Mais serviços opcionais como fotografia, contrato e análise de inquilino.",
};

type ServiceTone = "incluido" | "avulso" | "cotacao" | "gratis";

/**
 * Serviços do fechamento — cada um com STATUS honesto (Disponível / Via parceiro)
 * (rodada 25). A plataforma intermedia e documenta; nunca é a garantidora.
 * Caução e seguro-fiança são alternativas: por lei, só uma garantia por contrato.
 */
const SERVICES = [
  { icon: ShieldCheck, title: "Garantia digital (sem depósito)", benefit: "Entre sem imobilizar capital: uma taxa mensal diluída garante o aluguel, sem depósito de entrada. Contratada com parceiro, sujeita a análise.", price: "Cotação sob análise", statusLabel: "Via parceiro", statusTone: "partner", tone: "cotacao", cta: "Ver opções de garantia", href: "/dashboard/fechamento", highlight: "Recomendada · sem depósito" },
  { icon: PiggyBank, title: "Caução (depósito devolvível)", benefit: "Alternativa: depósito de até 3 aluguéis em conta vinculada (locador + locatário), devolvido ao fim. Vai para conta vinculada, nunca para a plataforma.", price: "Sem mensalidade", statusLabel: "Disponível", statusTone: "ok", tone: "avulso", cta: "Ver opções de garantia", href: "/dashboard/fechamento" },
  { icon: ClipboardList, title: "Vistoria documentada (entrada e saída)", benefit: "Inspeção imparcial do imóvel, com laudo em PDF, fotos e inventário da mobília. Ideal para quem não pode visitar o imóvel pessoalmente.", price: "Sob consulta", statusLabel: "Disponível via parceiro", statusTone: "partner", tone: "avulso", cta: "Solicitar vistoria", href: "/dashboard/fechamento", highlight: "Ideal para proprietário à distância" },
  { icon: FileSignature, title: "Contrato digital (ZapSign)", benefit: "Contrato de locação por temporada assinado digitalmente, com validade jurídica.", price: "Sem custo extra", statusLabel: "Disponível", statusTone: "ok", tone: "incluido", cta: "Incluído", href: "/precos" },
  { icon: UserCheck, title: "Verificação de identidade", benefit: "Confirmação de identidade e perfil para dar segurança à negociação.", price: "Sob consulta", statusLabel: "Disponível", statusTone: "ok", tone: "avulso", cta: "Adicionar", href: "/dashboard/verificacao" },
  { icon: Receipt, title: "Emissão de nota fiscal (NFS-e)", benefit: "Nota fiscal do aluguel emitida automaticamente, conforme a legislação.", price: "Sob consulta", statusLabel: "Disponível", statusTone: "ok", tone: "avulso", cta: "Adicionar", href: "/dashboard/assinatura" },
  { icon: Calculator, title: "Cotação de garantia", benefit: "Compare as opções de garantia e escolha a que cabe no seu caso.", price: "Gratuito", statusLabel: "Disponível", statusTone: "ok", tone: "gratis", cta: "Comparar garantias", href: "/dashboard/fechamento" },
  { icon: Camera, title: "Fotografia profissional", benefit: "Sessão de fotos do imóvel para anúncios que convertem mais.", price: "Sob consulta", statusLabel: "Via parceiro", statusTone: "partner", tone: "avulso", cta: "Adicionar", href: "/dashboard/assinatura" },
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

function ServiceCard({ s }: { s: (typeof SERVICES)[number] }) {
  const Icon = s.icon;
  const included = s.tone === "incluido";
  const highlight = "highlight" in s ? s.highlight : null;
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

      {/* Serviços opcionais — cards com ícone, benefício, preço e ação (rodada 24) */}
      <section className="bg-surface-2 py-12 md:py-20">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-title text-3xl font-bold text-ink">Serviços para o fechamento</h2>
            <p className="mt-4 text-muted">
              Reforce o anúncio e organize a negociação. Cada serviço mostra o status — o que
              já funciona e o que depende de parceiro. Contrate só o que precisar.
            </p>
            <p className="mx-auto mt-3 max-w-xl rounded-lg bg-white px-3 py-2 text-sm text-muted">
              <strong className="text-ink">Garantia, do seu jeito:</strong> escolha entre taxa
              mensal sem depósito (garantia digital) ou caução devolvível. Por lei, só uma
              garantia por contrato. A plataforma organiza e documenta; não é a garantidora.
            </p>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s) => (
              <ServiceCard key={s.title} s={s} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
