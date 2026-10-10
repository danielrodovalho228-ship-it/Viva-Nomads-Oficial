import type { Metadata } from "next";
import { Check, Camera, FileSignature, ShieldCheck, UserCheck, Banknote, PiggyBank } from "lucide-react";
import { TEXTO_REGRA_UNICA, TEXTO_REGRA_CURTO, cobrancaParaAceite } from "@/lib/cobranca/regra";
import { ComparativoPrecos } from "@/components/precos/comparativo-precos";
import { ButtonLink } from "@/components/ui/button";
import { formatBRL, cn } from "@/lib/utils";
import { CAUCAO_FRASE } from "@/lib/faixas";
import { JsonLd } from "@/components/seo/json-ld";
import { ofertaRegraUnica } from "@/lib/seo/estruturados";
import { SITE_URL, SUPORTE_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: "/precos" },
  title: "Anuncie imóveis mobiliados grátis: 12% só ao alugar",
  description: TEXTO_REGRA_CURTO + " Para imóveis mobiliados.",
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
  { icon: ShieldCheck, title: "Seguro-fiança (sem depósito)", benefit: "Entre sem deixar dinheiro preso: uma taxa mensal diluída garante o aluguel, sem depósito de entrada. Contratada com parceiro, sujeita a análise.", price: "Orçamento sob análise", statusLabel: "Via parceiro — em estruturação", statusTone: "partner", tone: "cotacao", cta: "Ver opções de garantia", href: "/como-funciona#garantias", highlight: "Sem depósito · parceiro em estruturação" },
  { icon: PiggyBank, title: "Caução (depósito devolvível)", benefit: `${CAUCAO_FRASE} Como manda o art. 38, §2º da Lei 8.245/91; devolvida ao fim da estadia.`, price: "Sem mensalidade", statusLabel: "Disponível", statusTone: "ok", tone: "avulso", cta: "Ver opções de garantia", href: "/como-funciona#garantias" },
];

const OWNER_SERVICES: Service[] = [
  { icon: Camera, title: "Fotografia profissional", benefit: "Sessão de fotos do imóvel para anúncios que convertem mais.", price: "Sob consulta", statusLabel: "Via parceiro", statusTone: "partner", tone: "avulso", cta: "Adicionar ao anúncio", href: "/dashboard/imoveis/novo" },
];

/**
 * Tecnologia & segurança — recursos que já vêm por baixo (o cliente nunca
 * contrata o fornecedor). Aparecem como BENEFÍCIO, sem nome de fornecedor.
 */
const TECH_BENEFITS = [
  { icon: FileSignature, title: "Contrato assinado digitalmente", text: "Contrato de locação por temporada com validade jurídica." },
  { icon: UserCheck, title: "Conversa registrada", text: "Toda a negociação fica na plataforma, com o contato protegido até o aceite." },
  { icon: Banknote, title: "Aluguel direto na conta do proprietário", text: "O pagamento do aluguel vai direto ao proprietário." },
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
      <JsonLd dados={ofertaRegraUnica(SITE_URL)} />

      <section className="bg-forest section-y text-center text-white">
        <div className="container-page">
          <h1 className="font-title text-4xl font-bold md:text-5xl">Anunciar é grátis</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-white/80">
            Você só paga quando alugar: <strong className="text-white">12% do primeiro aluguel</strong> de
            cada contrato e de cada renovação. Mesma regra para todos. O pagamento do aluguel vai direto ao proprietário.
          </p>
        </div>
      </section>

      <section className="container-page -mt-10 pb-16">
        <div className="mb-10 rounded-3xl border border-champagne bg-white p-6 shadow-xl ring-2 ring-champagne sm:p-8" data-testid="regra-unica">
          <h2 className="font-title text-2xl font-bold text-ink">Uma regra só, igual para todos</h2>
          <p className="mt-3 text-ink">{TEXTO_REGRA_UNICA}</p>
          <ul className="mt-5 space-y-3">
            {[
              "Anunciar é grátis, com quantos imóveis mobiliados você quiser.",
              "12% do primeiro aluguel de cada contrato novo e de cada renovação.",
              "Mesma taxa para quem tem 1 ou 100 imóveis. Sem desconto por volume.",
              "Sem mensalidade. O inquilino não paga taxa da plataforma.",
              "Cobrada do proprietário na assinatura do contrato ou da renovação; a plataforma não recebe nem retém o aluguel.",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-sm text-ink">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-sage" aria-hidden /> {t}
              </li>
            ))}
          </ul>
          <p className="mt-5 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">
            Exemplo: aluguel de R$ 4.320 por mês → {formatBRL(cobrancaParaAceite({ tipo: "novo", aluguelMensal: 4320, assinadoEm: new Date() }).valor)} no
            primeiro aluguel do contrato e {formatBRL(cobrancaParaAceite({ tipo: "renovacao", aluguelMensal: 4320, assinadoEm: new Date() }).valor)} em cada renovação.
          </p>
          <ButtonLink href="/qualificar" variant="gold" className="mt-6 w-full sm:w-auto">
            Anunciar meu imóvel
          </ButtonLink>
        </div>

        <ComparativoPrecos />
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
