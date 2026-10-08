"use client";

import { useState, useEffect } from "react";
import { Check, Percent, QrCode, Barcode, CreditCard, Copy, Loader2 } from "lucide-react";
import { PLANS } from "@/lib/constants";
import { useAuthStore, DEMO_USER, type SubscriptionPlan } from "@/lib/store";
import { getGestorElegibilidade, getMinhaAssinatura, type GestorElegibilidade, type MinhaAssinatura } from "@/lib/data/planos-actions";
import Link from "next/link";
import { useDemoMode } from "@/lib/demo/demo-mode";
import { LINK_DOCUMENTO } from "@/lib/documento-pessoa";
import { dataBR } from "@/lib/utils";
import { GESTOR_MIN_IMOVEIS_VALIDADOS } from "@/lib/planos/gestor";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { formatBRL, cn } from "@/lib/utils";
import { SUPORTE_EMAIL } from "@/lib/site";
import { AVISO_DESCER_PLANO, ficaAcimaDoLimite } from "@/lib/planos/descer-plano";
import { LIMITE_ANUNCIOS } from "@/config/planos";

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
  const setUser = useAuthStore((s) => s.setUser);
  const activePlan = (user ?? DEMO_USER).plan ?? "free";
  const { on: demoOn } = useDemoMode();
  // Situação REAL (servidor): plano que vale agora, anúncios ativos, cobrança ligada, CPF/CNPJ.
  const [minha, setMinha] = useState<MinhaAssinatura | null>(null);
  useEffect(() => {
    let vivo = true;
    getMinhaAssinatura()
      .then((m) => vivo && setMinha(m))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);
  const currentPlanId = minha?.plano ?? "free";
  const nomePlanoAtual = PLANS.find((p) => p.id === currentPlanId)?.name ?? "Gratuito";
  const limite = minha && Number.isFinite(minha.limiteAnuncios) ? minha.limiteAnuncios : null;

  function switchDemoPlan(plan: SubscriptionPlan) {
    setUser({ ...(user ?? DEMO_USER), plan });
  }
  const [selected, setSelected] = useState<string | null>(null);
  const [billing, setBilling] = useState<Billing>("PIX");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SubResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Elegibilidade do Gestor (regra 1): barreira como META, nunca porta muda.
  const [gestor, setGestor] = useState<GestorElegibilidade | null>(null);
  useEffect(() => {
    let alive = true;
    getGestorElegibilidade()
      .then((g) => { if (alive) setGestor(g); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

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
          // Nome, e-mail e CPF/CNPJ: o servidor lê do perfil (A5).
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

      {/* Alternador de plano (demonstração) — SÓ no modo demonstração (conta real nunca vê). */}
      {demoOn && (
      <Panel className="mb-6">
        <p className="text-sm font-medium text-ink">Visualizar como plano (demonstração)</p>
        <p className="mt-0.5 text-xs text-muted">
          Recursos de operador (viabilidade e consolidação do portfólio) aparecem apenas no plano Gestor.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["free", "essential", "pro", "gestor"] as const).map((p) => (
            <button
              key={p}
              onClick={() => switchDemoPlan(p)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium capitalize transition-colors",
                activePlan === p
                  ? "border-forest bg-forest text-white"
                  : "border-sage-200 text-ink hover:border-sage"
              )}
            >
              {p === "free" ? "Gratuito" : p}
            </button>
          ))}
        </div>
      </Panel>
      )}

      <Panel className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div data-testid="plano-atual">
          <p className="text-sm text-muted">Plano atual</p>
          <p className="font-title text-xl font-bold text-ink">{nomePlanoAtual}</p>
          <p className="text-sm text-muted">
            {minha
              ? `${minha.anunciosAtivos} de ${limite ?? "ilimitados"} anúncio${limite === 1 ? "" : "s"} ativo${limite === 1 ? "" : "s"}`
              : "Carregando…"}
            {minha?.fundadorAte ? ` · Fundador: Profissional sem custo até ${dataBR(minha.fundadorAte)}` : ""}
          </p>
        </div>
        <span className="rounded-full bg-sage-100 px-3 py-1.5 text-sm font-medium text-forest">
          Pagamento nativo: PIX · Boleto · Cartão
        </span>
      </Panel>

      {minha && ficaAcimaDoLimite(minha.anunciosAtivos, limite) && (
        <div data-testid="aviso-limite-plano-atual" role="status" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>{AVISO_DESCER_PLANO}</p>
        </div>
      )}

      {minha && !minha.pagamentosAtivos && (
        <div data-testid="pagamentos-em-breve" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">As assinaturas pagas abrem no lançamento.</p>
          <p className="mt-1">
            Por enquanto não dá para pagar por aqui. Se você precisa de mais anúncios agora, clique em &quot;Quero este plano&quot;: a
            equipe libera e combina com você.
          </p>
        </div>
      )}
      {minha && minha.pagamentosAtivos && !minha.temDocumento && (
        <div data-testid="assinatura-sem-documento" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>Para assinar, informe antes seu CPF (ou o CNPJ da empresa): a cobrança sai nele.</p>
          <Link href={LINK_DOCUMENTO} className="mt-2 inline-block font-semibold text-forest underline">
            Informar meu documento
          </Link>
        </div>
      )}

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
                <span className="font-title text-3xl font-bold text-forest">
                  {isCustom ? "Sob consulta" : plan.price === 0 ? "Grátis" : formatBRL(plan.price ?? 0)}
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
              {/* Custo (comissão) separado dos benefícios — não disfarçar (N5) */}
              {plan.cost && (
                <p className="mt-3 flex items-start gap-2 rounded-lg bg-surface-2 px-2.5 py-2 text-xs text-muted">
                  <Percent className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" /> {plan.cost}
                </p>
              )}
              {isCustom ? (
                /* Gestor é plano de ELEGIBILIDADE — venda assistida no piloto.
                   Nunca uma porta muda: mostra o critério (meta) + o canal. */
                <div className="mt-5">
                  <p className="mb-2 rounded-lg bg-surface-2 px-2.5 py-2 text-xs text-muted">
                    {gestor?.elegivel
                      ? "✓ Você é elegível ao Gestor. Fale com a gente para ativar."
                      : `Disponível para administradoras ou ${GESTOR_MIN_IMOVEIS_VALIDADOS}+ imóveis com documentação aprovada${
                          gestor ? ` — você tem ${gestor.imoveisValidados}/${GESTOR_MIN_IMOVEIS_VALIDADOS}` : ""
                        }.`}
                  </p>
                  <a
                    href={`mailto:${SUPORTE_EMAIL}?subject=Plano%20Gestor`}
                    className="flex w-full items-center justify-center rounded-xl border border-forest px-4 py-2.5 text-sm font-semibold text-forest hover:bg-forest/5"
                  >
                    Fale com a gente
                  </a>
                </div>
              ) : minha && !minha.pagamentosAtivos && !current && !!plan.price ? (
                <a
                  href={`mailto:${SUPORTE_EMAIL}?subject=${encodeURIComponent(`Quero o plano ${plan.name}`)}`}
                  data-testid={`quero-plano-${plan.id}`}
                  className="mt-5 flex w-full items-center justify-center rounded-xl border border-forest px-4 py-2.5 text-sm font-semibold text-forest hover:bg-forest/5"
                >
                  Quero este plano
                </a>
              ) : (
                <Button
                  variant={current ? "outline" : plan.featured ? "gold" : "primary"}
                  className="mt-5 w-full"
                  disabled={current || plan.price === 0 || (!!minha && !minha.temDocumento)}
                  onClick={() => subscribe(plan.id)}
                >
                  {current ? "Plano atual" : plan.price === 0 ? "Plano gratuito" : plan.cta}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Forma de pagamento */}
      {selected && (
        <Panel className="mt-6" title="Forma de pagamento">
          {minha && ficaAcimaDoLimite(minha.anunciosAtivos, LIMITE_ANUNCIOS[selected as keyof typeof LIMITE_ANUNCIOS]) && (
            <p data-testid="aviso-descer-plano" role="status" className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {AVISO_DESCER_PLANO}
            </p>
          )}
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

      {/* D1 — cobranças da assinatura moram AQUI (não em "Carteira"/"Reembolsos"
          do menu). Assinatura é o único lugar de dinheiro da plataforma, e mesmo
          assim só a assinatura: o aluguel nunca passa pela Viva Nomads. */}
      <Panel className="mt-6" title="Pagamentos da assinatura">
        <p className="text-sm text-muted">
          Histórico de cobranças da sua assinatura (PIX, boleto ou cartão). O aluguel do inquilino
          nunca passa pela plataforma.
        </p>
        <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">
          Nenhuma cobrança até agora — seu plano atual é <strong className="text-ink">{nomePlanoAtual}</strong>.
        </p>
      </Panel>

      <Panel className="mt-6" title="Reembolsos da assinatura">
        <p className="text-sm text-muted">
          Eventuais estornos de cobranças da assinatura aparecem aqui. (Não confundir com a caução
          da locação, que é combinada entre proprietário e inquilino, fora da plataforma.)
        </p>
        <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">
          Nenhum reembolso de assinatura.
        </p>
      </Panel>

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
