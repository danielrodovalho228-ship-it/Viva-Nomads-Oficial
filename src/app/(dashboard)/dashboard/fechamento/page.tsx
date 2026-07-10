"use client";

import Link from "next/link";
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
  Clock,
  Info,
} from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { Button, ButtonLink } from "@/components/ui/button";
import { useDashDemo } from "@/lib/demo/demo-mode";
import { PropertyMiniCard } from "@/components/property-mini-card";
import { DocumentShare } from "@/components/document-share";
import { SAMPLE_PROPERTIES } from "@/lib/properties";
import { formatDocNumber } from "@/lib/documents";
import { PlatformLegalNotice, OwnerDecisionNotice } from "@/components/legal-notice";
import {
  COST_SPLIT_ITEMS,
  TRAFFIC_LIGHT_META,
  type CafResult,
  type CostParty,
} from "@/lib/closing";
import {
  garantiasElegiveis,
  garantiaSelecionavel,
  servicosVisiveis,
  servicoSelecionavel,
  REGRA_DE_OURO,
  type Garantia,
} from "@/lib/guarantees";
import {
  valorParcela,
  MAX_PARCELAS,
  type FormaPagamentoCaucao,
} from "@/lib/caucao";
import { COMMISSION_BY_PLAN } from "@/lib/constants";
import { registrarContrato } from "@/lib/data/actions";
import { resumoContrato } from "@/lib/contrato-blocos";
import { faixaForDays, faixaLabel } from "@/lib/faixas";
import {
  selecionarModeloContrato,
  faixaResumo,
  CLAUSULAS_PLACEHOLDER,
} from "@/lib/modelos-contrato";
import { formatBRL, cn } from "@/lib/utils";

const STEPS = ["Candidatura & verificação", "Garantia", "Serviços", "Patrimonial", "Contrato", "Resumo"];

// Inquilino e imóvel da candidatura (mock — viria do lead selecionado). Usado
// SÓ no ramo demo (ClosingPreview), nunca em conta real — ver gate abaixo.
const TENANT = { name: "Ana Carvalho", profile: "Médica · residência", foreigner: false }; // consistency-ignore: persona de demonstração, renderizada só sob o gate demo
// Imóvel completo para o card do topo (Atualização 16) + número do contrato.
const PROPERTY_FULL = SAMPLE_PROPERTIES.find((p) => p.id === "ube-001") ?? SAMPLE_PROPERTIES[0];
const CONTRACT_NUMBER = formatDocNumber("contrato", 2026, 42);
// Prazo total pretendido (contrato-mãe). Inicial mock do lead (4 meses); o
// inquilino ajusta no fechamento. Blocos de 2 meses (≤ 90 dias cada).
const DEFAULT_MESES = 4;
const MESES_MIN = 1;
const MESES_MAX = 6;
const TAMANHO_BLOCO = 2;
const PROPERTY = {
  title: PROPERTY_FULL.title,
  monthlyRent: PROPERTY_FULL.monthlyPrice,
};
// Capacidade máxima do imóvel (Onda 1) — do cadastro (max_guests).
const CAPACIDADE = PROPERTY_FULL.maxGuests ?? 4;
// Serviços visíveis (inclui "em breve" como slot). Opcionais e combináveis.
const SERVICOS_VISIVEIS = servicosVisiveis();
// Plano do proprietário define a comissão de fechamento (12% / 10% / 8% / 0%).
const OWNER_PLAN = "essential";
const COMMISSION_RATE = COMMISSION_BY_PLAN[OWNER_PLAN];
// Comissão do contrato-mãe: 1 mês × taxa, UMA vez (não por bloco, não recobra).
const PLATFORM_COMMISSION = Math.round(PROPERTY.monthlyRent * COMMISSION_RATE);
const OWNER_NET = PROPERTY.monthlyRent - PLATFORM_COMMISSION;
// Taxa de limpeza/preparação (Bloco B)
const PREP_FEE = 450;
const CHECKOUT_FEE = 250;

/**
 * Fechamento (B4/B5/B6 — fronteira demo/real). O fluxo abaixo é um PREVIEW
 * populado com dados de exemplo (inquilino, imóvel e número de contrato
 * fictícios). Por isso ele só renderiza no MODO DEMONSTRAÇÃO. Conta real (demo
 * desligado) vê o estado honesto de `FechamentoReal` — o fechamento de verdade
 * abre a partir de uma candidatura aceita, sem nenhum dado fictício vazando.
 * Regra: preview só no modo demo.
 */
export default function ClosingPage() {
  const demo = useDashDemo();
  return demo ? <ClosingPreview /> : <FechamentoReal />;
}

/* ─────────────────────────────────────────────────────────────────────────
   CONTA REAL — sem candidatura selecionada ainda. Estado honesto, dentro da
   casca. Nenhum nome ou número de contrato fictício para conta real.
   ───────────────────────────────────────────────────────────────────────── */
function FechamentoReal() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle
        title="Fechamento"
        subtitle="O fechamento abre quando você aceita uma candidatura."
      />
      <EmptyState
        icon={FileSignature}
        title="Nenhuma candidatura em fechamento"
        text="Quando você aceitar uma candidatura, ela aparece aqui com verificação, garantia, serviços e a geração do contrato — sempre com os dados reais do inquilino. A plataforma conecta, verifica e documenta; o acordo é fechado direto entre vocês."
        action={
          <ButtonLink href="/dashboard/mensagens" variant="primary">
            <ArrowRight className="h-4 w-4" /> Ver conversas e candidaturas
          </ButtonLink>
        }
      />
      <div className="mt-4">
        <OwnerDecisionNotice />
      </div>
    </div>
  );
}

function ClosingPreview() {
  const [step, setStep] = useState(0);
  // Prazo total pretendido (contrato-mãe) — o inquilino escolhe no fechamento.
  const [prazoMeses, setPrazoMeses] = useState(DEFAULT_MESES);
  // Derivações do prazo (dinâmicas). Nomes espelham os antigos p/ o JSX seguir.
  const STAY_MESES = prazoMeses;
  const STAY_DAYS = prazoMeses * 30;
  const FAIXA = faixaForDays(STAY_DAYS);
  const FAIXA_LABEL = faixaLabel(FAIXA);
  const FAIXA_RESUMO = faixaResumo(FAIXA);
  const MODELO_CONTRATO = useMemo(
    () => selecionarModeloContrato(FAIXA, PROPERTY_FULL.propertyType),
    [FAIXA]
  );
  const ELEGIVEIS = useMemo(() => garantiasElegiveis(STAY_DAYS), [STAY_DAYS]);
  // Contrato fracionado: blocos de 2 meses, caução 50% por bloco, comissão única.
  const resumo = useMemo(
    () => resumoContrato(prazoMeses, PROPERTY.monthlyRent, COMMISSION_RATE, TAMANHO_BLOCO),
    [prazoMeses]
  );
  const VALOR_ESTADIA = resumo.valorTotalPeriodo;
  const CAUCAO_50 = resumo.caucaoTotal; // total do período (soma dos blocos)
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cafResult, setCafResult] = useState<CafResult | null>(null);
  const [signUrl, setSignUrl] = useState<string | null>(null);
  // Seleção ÚNICA de garantia: guardamos um único id. Selecionar outra substitui
  // a anterior — é impossível ter duas garantias no contrato (Lei 8.245, art. 37).
  // Caução é a opção PADRÃO (obrigatória): nenhum fechamento avança sem garantia,
  // e a caução cobre todas as faixas de prazo (1..180). O usuário pode trocar.
  const [guaranteeId, setGuaranteeId] = useState<string | null>("caucao");
  // Nº de pessoas que vão morar (Onda 1) — informado pelo inquilino, validado
  // contra a capacidade do imóvel. Vai para o registro da locação (cláusula de
  // ocupação). Excedeu a capacidade → bloqueia e sugere outro imóvel.
  const [qtdOcupantes, setQtdOcupantes] = useState(1);
  const ocupantesExcede = qtdOcupantes > CAPACIDADE;
  // Caução flexível: como o inquilino paga a caução (não trava o aluguel).
  // À vista → conta vinculada; parcelado → emissor do cartão. Nunca a plataforma.
  const [caucaoForma, setCaucaoForma] = useState<FormaPagamentoCaucao>("avista");
  const [caucaoParcelas, setCaucaoParcelas] = useState(MAX_PARCELAS);
  // Serviços adicionais: multi-seleção (combináveis), separados da garantia e
  // sempre OPCIONAIS. Guardamos a lista de ids selecionados.
  const [services, setServices] = useState<string[]>([]);
  const [patrimonial, setPatrimonial] = useState<boolean | null>(null);
  const [split, setSplit] = useState<Record<string, CostParty>>(
    Object.fromEntries(COST_SPLIT_ITEMS.map((i) => [i.key, i.default]))
  );
  const [generated, setGenerated] = useState(false);

  const selectedGarantia = useMemo<Garantia | null>(
    () => ELEGIVEIS.find((g) => g.id === guaranteeId) ?? null,
    [guaranteeId, ELEGIVEIS]
  );

  function next() {
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }
  function back() {
    setStep((s) => Math.max(0, s - 1));
  }

  // Liga/desliga um serviço (combináveis). Só serviços selecionáveis entram.
  function toggleService(id: string) {
    setServices((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function runVerification() {
    setVerifying(true);
    // Laudo de demonstração — usado se a API falhar, garantindo que o semáforo
    // sempre apareça e o fluxo possa avançar (A4).
    const demo: CafResult = {
      light: "green",
      identity: true,
      liveness: true,
      document: true,
      coversForeigners: true,
      demo: true,
      notes: [
        "Identidade confirmada",
        "Prova de vida aprovada",
        "Sem execuções fiscais relevantes",
      ],
    };
    try {
      const res = await fetch("/api/caf/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: TENANT.name }),
      });
      const data = res.ok ? ((await res.json()) as CafResult) : demo;
      setCafResult(data?.light ? data : demo);
    } catch {
      setCafResult(demo);
    } finally {
      setVerified(true);
      setVerifying(false);
    }
  }

  // Etapas do stepper já alcançadas são clicáveis (A4).
  const maxReached = useMemo(() => {
    // Ocupação acima da capacidade trava o fechamento na 1ª etapa (Onda 1).
    if (!verified || ocupantesExcede) return 0;
    if (!guaranteeId) return 1;
    // Serviços (2) é opcional: com a garantia escolhida, libera até patrimonial (3).
    if (patrimonial === null) return 3;
    if (!generated) return 4; // Resumo só após gerar o contrato
    return 5;
  }, [verified, ocupantesExcede, guaranteeId, patrimonial, generated]);

  function goToStep(target: number) {
    if (target <= maxReached) setStep(target);
  }

  async function generateContract() {
    try {
      const res = await fetch("/api/contrato", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantName: TENANT.name,
          ownerName: "Proprietário",
          propertyTitle: PROPERTY.title,
          monthlyRent: PROPERTY.monthlyRent,
          termMonths: prazoMeses,
          guarantee: selectedGarantia?.nome ?? "",
          costSplit: split,
        }),
      });
      const data = await res.json();
      setSignUrl(data.signUrl ?? null);
      // Registra a comissão de fechamento (split sobre o 1º mês).
      await fetch("/api/comissao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstMonthRent: PROPERTY.monthlyRent,
          plan: OWNER_PLAN,
          name: TENANT.name,
        }),
      }).catch(() => {});
      // Garantia na chave do banco (caução vira à vista/parcelada pela forma).
      const garantiaKey =
        guaranteeId === "caucao"
          ? caucaoForma === "parcelado"
            ? "caucao_parcelada"
            : "caucao_avista"
          : guaranteeId ?? "caucao_avista";
      // Registra o CONTRATO-MÃE + blocos (contrato fracionado v2). A comissão
      // fica no contrato-mãe (1 mês × taxa, UMA vez); cada bloco carrega a
      // caução (50%). Best-effort: no-op em demo/imóvel-exemplo; persiste no real.
      const inicioISO = new Date().toISOString().slice(0, 10);
      await registrarContrato({
        propertyId: PROPERTY_FULL.id,
        faixa: FAIXA,
        ownerPlan: OWNER_PLAN,
        prazoTotalMeses: prazoMeses,
        aluguelMensal: PROPERTY.monthlyRent,
        tamanhoBlocoMeses: TAMANHO_BLOCO,
        qtdOcupantes: qtdOcupantes,
        capacidadeSnapshot: CAPACIDADE,
        inicioISO,
        caucaoForma: caucaoForma === "parcelado" ? "preauth_cartao" : "avista",
      }).catch(() => {});
      // `garantiaKey` alimenta o texto do contrato (à vista/parcelada).
      void garantiaKey;
      setGenerated(true);
    } catch {
      setGenerated(true);
    }
  }

  const canAdvance =
    (step === 0 && verified && !ocupantesExcede) ||
    (step === 1 && !!guaranteeId) ||
    step === 2 || // serviços: opcional, pode seguir sem escolher
    (step === 3 && patrimonial !== null) ||
    (step === 4 && generated);

  // Motivo de bloqueio para avançar — feedback claro em vez de só desabilitar (N1).
  const pendingReason =
    step === 0 && !verified
      ? "Conclua a verificação de identidade para continuar."
      : step === 0 && ocupantesExcede
        ? `Este imóvel comporta até ${CAPACIDADE} pessoas. Reduza o número de ocupantes ou escolha outro imóvel.`
      : step === 1 && !guaranteeId
        ? "Selecione uma garantia para continuar."
        : step === 3 && patrimonial === null
          ? "Defina o seguro patrimonial para continuar."
          : step === 4 && !generated
            ? "Gere o contrato para continuar."
            : null;

  return (
    <div>
      <PageTitle
        title="Fechamento"
        subtitle={`Contrato ${CONTRACT_NUMBER} · você está fechando uma candidatura`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Resumo lateral (sticky no desktop) — aproveita a largura da tela */}
        <aside className="order-1 lg:order-2 lg:col-span-1">
          <div className="space-y-4 lg:sticky lg:top-20">
            <PropertyMiniCard property={PROPERTY_FULL} />
            {/* Identificação clara dos papéis (A6) */}
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white px-4 py-3 text-sm">
              <span className="rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700">
                Inquilino: {TENANT.name}
              </span>
              <span className="text-muted">{TENANT.profile}</span>
              <ArrowRight className="h-4 w-4 text-muted" />
              <span className="rounded-full bg-surface-2 px-2.5 py-1 font-medium text-ink">
                {PROPERTY.title}
              </span>
            </div>
          </div>
        </aside>

        {/* Coluna principal: stepper + etapas do wizard */}
        <div className="order-2 lg:order-1 lg:col-span-2">
          {/* Stepper (passos alcançados são clicáveis — A4).
              Rola no mobile; quebra em linhas no desktop (sem scroll horizontal). */}
          <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible sm:pb-0">
        {STEPS.map((s, i) => {
          const reachable = i <= maxReached;
          return (
            <button
              key={s}
              type="button"
              onClick={() => goToStep(i)}
              disabled={!reachable}
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
                i === step
                  ? "bg-forest text-white"
                  : i < step
                    ? "bg-sage-100 text-forest hover:bg-blue-100"
                    : reachable
                      ? "bg-surface-2 text-ink hover:bg-blue-50"
                      : "bg-surface-2 text-muted opacity-60"
              )}
            >
              {i < step ? <Check className="h-4 w-4" /> : <span>{i + 1}</span>}
              {s}
            </button>
          );
        })}
      </div>

      <Panel>
        {/* ── 8.1 CANDIDATURA + VERIFICAÇÃO CAF ── */}
        {step === 0 && (
          <div className="space-y-5">
            {/* Alinha expectativas desde o início: a decisão é do proprietário */}
            <OwnerDecisionNotice />
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
                  Verificação de identidade: documento, foto (selfie) e análise antifraude, com
                  risco contextual. Cobre estrangeiros (CRNM/RNE).
                </p>
                <Button variant="gold" className="mt-4" onClick={runVerification} disabled={verifying}>
                  {verifying ? "Verificando..." : "Iniciar verificação de identidade"}
                </Button>
              </div>
            ) : (
              cafResult && <CafLaudo result={cafResult} />
            )}

            {/* Ocupação (Onda 1): nº de pessoas × capacidade do imóvel. */}
            <div className="rounded-xl border border-sage-200 p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">Quantas pessoas vão morar?</p>
                  <p className="text-xs text-muted">Este imóvel comporta até {CAPACIDADE} pessoas.</p>
                </div>
                <input
                  type="number"
                  min={1}
                  value={qtdOcupantes}
                  onChange={(e) => setQtdOcupantes(Math.max(1, Math.round(Number(e.target.value) || 1)))}
                  aria-label="Número de ocupantes"
                  className="w-20 rounded-lg border border-sage-200 bg-white px-3 py-2 text-center outline-none focus:border-sage"
                />
              </div>
              {ocupantesExcede && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                  {qtdOcupantes} pessoas excede a capacidade deste imóvel ({CAPACIDADE}). Reduza o
                  número ou{" "}
                  <Link href="/buscar" className="font-medium underline">
                    veja outros imóveis com mais espaço
                  </Link>
                  .
                </p>
              )}
            </div>

            {/* Prazo total pretendido (contrato-mãe) + prévia dos blocos. */}
            <div className="rounded-xl border border-sage-200 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">Por quanto tempo você quer ficar?</p>
                  <p className="text-xs text-muted">
                    Prazo total pretendido — cria o <strong>contrato-mãe</strong>. Contratado em{" "}
                    blocos de {TAMANHO_BLOCO} meses (cada bloco ≤ 90 dias).
                  </p>
                </div>
                <select
                  value={prazoMeses}
                  onChange={(e) => setPrazoMeses(Number(e.target.value))}
                  aria-label="Prazo total em meses"
                  className="rounded-lg border border-sage-200 bg-white px-3 py-2 outline-none focus:border-sage"
                >
                  {Array.from({ length: MESES_MAX - MESES_MIN + 1 }, (_, i) => MESES_MIN + i).map(
                    (m) => (
                      <option key={m} value={m}>
                        {m} {m === 1 ? "mês" : "meses"}
                      </option>
                    )
                  )}
                </select>
              </div>
              <p className="mt-3 text-xs text-muted">
                {resumo.blocos.length} {resumo.blocos.length === 1 ? "bloco" : "blocos"} ·{" "}
                {formatBRL(PROPERTY.monthlyRent)}/mês · total do período{" "}
                <strong className="text-ink">{formatBRL(resumo.valorTotalPeriodo)}</strong>.
              </p>
            </div>

            <OwnerDecisionNotice />
          </div>
        )}

        {/* ── 8.2 ESCOLHA DE GARANTIA (única, orientada a dados) ── */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="font-title text-lg font-bold text-ink">
                Escolha como garantir o aluguel
              </h2>
              <p className="mt-1 text-sm text-muted">
                A lei permite <strong>uma</strong> garantia por contrato (Lei 8.245, art. 37).
                Para esta estadia de <strong>{STAY_MESES} meses</strong> (~{STAY_DAYS} dias), estas
                são as opções:
              </p>
              <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
                {STAY_DAYS < 90
                  ? "Até 89 dias (temporada): garantia por caução — ideal para estadias curtas."
                  : "90 a 180 dias (residencial): caução ou garantidor digital (em breve)."}
              </p>
            </div>

            <div className="space-y-3" role="radiogroup" aria-label="Garantia locatícia">
              {ELEGIVEIS.map((g) => {
                const selectable = garantiaSelecionavel(g);
                const active = guaranteeId === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-disabled={!selectable}
                    disabled={!selectable}
                    onClick={() => selectable && setGuaranteeId(g.id)}
                    className={cn(
                      "w-full rounded-xl border-2 p-4 text-left transition-colors",
                      active
                        ? "border-forest bg-sage-100"
                        : selectable
                          ? "border-sage-200 hover:border-sage"
                          : "cursor-not-allowed border-sage-200 bg-surface-2 opacity-70"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-title font-bold text-ink">
                        {g.nome}
                        {g.parceiroNome && (
                          <span className="ml-2 text-xs font-normal text-muted">
                            via {g.parceiroNome}
                          </span>
                        )}
                      </span>
                      <span
                        className={cn(
                          "grid h-5 w-5 shrink-0 place-items-center rounded-full border",
                          active ? "border-forest bg-forest text-white" : "border-sage-200"
                        )}
                      >
                        {active && <Check className="h-3.5 w-3.5" />}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-semibold",
                          g.reembolsavel
                            ? "bg-green-50 text-green-900"
                            : "bg-blue-50 text-blue-700"
                        )}
                      >
                        {g.reembolsavel ? "Reembolsável" : "Não reembolsável"}
                      </span>
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted">
                        Pago pelo {g.quemPaga === "inquilino" ? "inquilino" : "proprietário"}
                      </span>
                      {selectable ? (
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-900">
                          Disponível
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          <Clock className="h-3 w-3" /> Em breve
                        </span>
                      )}
                    </div>
                    {g.observacao && <p className="mt-2 text-sm text-muted">{g.observacao}</p>}
                    {!selectable && (
                      <p className="mt-2 text-xs text-muted">
                        Disponível em breve — via parceiro. Por ora, escolha caução.
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Como funciona a sua proteção — diferencial (lidera pelo benefício). */}
            <div className="rounded-xl border border-sage-200 bg-surface-2 p-4 text-sm">
              <p className="font-medium text-ink">Como funciona a sua proteção</p>
              <ul className="mt-2 space-y-1.5 text-muted">
                <li className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-forest" />
                  <span>
                    <strong className="text-ink">Garantia de verdade:</strong> cobre o aluguel,
                    não só danos.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-forest" />
                  <span>
                    <strong className="text-ink">Feita para 30 a 180 dias</strong> — no prazo da
                    sua estadia.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-forest" />
                  <span>
                    <strong className="text-ink">Seu dinheiro nunca fica com a plataforma</strong> —
                    fica em conta vinculada e volta para você.
                  </span>
                </li>
              </ul>
            </div>

            {/* Regra de ouro — sempre visível na etapa de garantia. */}
            <p className="flex items-start gap-2 rounded-lg border border-sage-200 bg-surface-2 px-3 py-2 text-xs text-muted">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
              {REGRA_DE_OURO}
            </p>

            {/* Sub-fluxo conforme a garantia escolhida. */}
            {selectedGarantia?.tipo === "caucao" && (
              <div className="space-y-3 rounded-xl border border-sage-200 p-4 text-sm">
                <p className="font-medium text-ink">Caução por bloco (50% do bloco)</p>
                <p className="text-xs text-muted">
                  O período é contratado em blocos de {TAMANHO_BLOCO} meses. Cada bloco tem a
                  caução <strong>integral</strong> (50% do valor do bloco) — cabe no cartão e vai
                  para a conta vinculada. A plataforma nunca recebe.
                </p>

                {/* Tabela transparente por bloco: aluguel, caução, desembolso. */}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[380px] text-xs">
                    <thead>
                      <tr className="text-left text-muted">
                        <th className="py-1.5 pr-2 font-medium">Bloco</th>
                        <th className="py-1.5 pr-2 font-medium">Aluguel</th>
                        <th className="py-1.5 pr-2 font-medium">Caução (50%)</th>
                        <th className="py-1.5 font-medium">Desembolso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumo.blocos.map((b) => (
                        <tr key={b.numero} className="border-t border-sage-200/60">
                          <td className="py-1.5 pr-2 text-ink">
                            {b.numero} <span className="text-muted">({b.meses}m)</span>
                          </td>
                          <td className="py-1.5 pr-2 text-ink">{formatBRL(b.valor)}</td>
                          <td className="py-1.5 pr-2 text-ink">{formatBRL(b.caucao)}</td>
                          <td className="py-1.5 font-medium text-forest">
                            {formatBRL(b.desembolso)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-sage-200 font-medium text-ink">
                        <td className="py-1.5 pr-2">Total</td>
                        <td className="py-1.5 pr-2">{formatBRL(VALOR_ESTADIA)}</td>
                        <td className="py-1.5 pr-2">{formatBRL(CAUCAO_50)}</td>
                        <td className="py-1.5">{formatBRL(VALOR_ESTADIA + CAUCAO_50)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="rounded-lg bg-sage-100 px-3 py-2 text-xs text-forest">
                  Para começar você paga só o <strong>1º bloco</strong>:{" "}
                  {formatBRL(resumo.desembolsoPrimeiroBloco)} (aluguel + caução). Os próximos blocos
                  são contratados por renovação, sempre com seu aceite — nunca automática.
                </p>

                {/* Caução flexível: o inquilino escolhe como pagar. */}
                <div>
                  <p className="mb-1.5 font-medium text-ink">Como você quer pagar?</p>
                  <div className="flex rounded-full bg-surface-2 p-0.5 text-xs">
                    {(
                      [
                        ["avista", "À vista (Pix/boleto)"],
                        ["parcelado", "Parcelado no cartão"],
                      ] as const
                    ).map(([forma, label]) => (
                      <button
                        key={forma}
                        type="button"
                        aria-pressed={caucaoForma === forma}
                        onClick={() => setCaucaoForma(forma)}
                        className={cn(
                          "flex-1 rounded-full px-3 py-1.5 font-medium transition-colors",
                          caucaoForma === forma ? "bg-forest text-white" : "text-muted"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {caucaoForma === "parcelado" && (
                    <div className="mt-3">
                      <label className="flex items-center justify-between gap-3">
                        <span className="text-muted">Parcelas (caução do 1º bloco)</span>
                        <select
                          value={caucaoParcelas}
                          onChange={(e) => setCaucaoParcelas(Number(e.target.value))}
                          className="rounded-lg border border-sage-200 bg-white px-2 py-1 text-sm outline-none focus:border-sage"
                        >
                          {Array.from({ length: MAX_PARCELAS }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>
                              {n}x
                            </option>
                          ))}
                        </select>
                      </label>
                      <Row
                        label={`${caucaoParcelas}x de`}
                        value={`${formatBRL(valorParcela(resumo.blocos[0]?.caucao ?? 0, caucaoParcelas))}/mês`}
                      />
                      {/*
                        NOTA TÉCNICA (Fase 4 — sem captura real ainda): quando a
                        pré-autorização no cartão for integrada (aguarda parecer +
                        gateway), lembrar que pré-autorizações expiram em ~5–30 dias
                        (varia por adquirente/bandeira) e NÃO cobrem um bloco de 60
                        dias sem renovar a autorização. A mecânica final (recaptura,
                        renovação de auth ou caução via Pix/boleto para conta do
                        proprietário) depende do jurídico. Aqui só registramos a
                        forma escolhida — nenhum valor é capturado.
                      */}
                    </div>
                  )}
                </div>

                {/* Texto de conversão. */}
                <p className="rounded-lg bg-sage-100 px-3 py-2 text-xs text-forest">
                  Você escolhe como pagar: à vista ou parcelado. O valor é seu — devolvido ao
                  final, se estiver tudo certo com o imóvel.
                </p>

                {/* Destino do dinheiro — nunca a plataforma. */}
                <p className="flex items-start gap-1.5 text-muted">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {caucaoForma === "avista" ? (
                    <>
                      O depósito vai para uma <strong>conta vinculada</strong> em nome do locador,
                      fora da plataforma, e é devolvido ao fim.
                    </>
                  ) : (
                    <>
                      No parcelado, o valor vai para a <strong>instituição emissora</strong> do
                      cartão, fora da plataforma.
                    </>
                  )}{" "}
                  A plataforma registra e documenta — <strong>nunca recebe nem retém o valor</strong>.
                  O inquilino anexa o comprovante e o status fica “caução comprovada”.
                </p>
              </div>
            )}
            {/* Título de capitalização foi APOSENTADO (decisão de 2 advogados) —
                não é mais oferecido como garantia. */}
            {selectedGarantia?.tipo === "garantidor_digital" && (
              <div className="space-y-2 rounded-xl border border-sage-200 p-4 text-sm">
                <p className="font-medium text-ink">Como funciona o garantidor digital</p>
                <p className="text-muted">
                  A plataforma conecta você ao parceiro garantidor. O inquilino contrata
                  diretamente — a plataforma registra e documenta a apólice. Não há depósito
                  nem retenção de valores pela plataforma.
                  {selectedGarantia.parceiroNome && (
                    <> Parceiro atual: <strong>{selectedGarantia.parceiroNome}</strong>.</>
                  )}
                </p>
              </div>
            )}

            {selectedGarantia && (
              <p className="rounded-lg bg-sage-100 px-3 py-2 text-xs text-forest">
                Garantia selecionada: <strong>{selectedGarantia.nome}</strong>. Só uma é válida no
                contrato — as demais ficam bloqueadas.
              </p>
            )}
          </div>
        )}

        {/* ── 8.2-b SERVIÇOS ADICIONAIS (separados, opcionais, combináveis) ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="font-title text-lg font-bold text-ink">Serviços adicionais</h2>
              <p className="mt-1 text-sm text-muted">
                Opcionais e <strong>combináveis</strong> — <strong>não são garantia</strong>. A
                plataforma intermedeia e roteia o pagamento ao prestador;{" "}
                <strong>não executa o serviço</strong>. Você pode seguir sem nenhum.
              </p>
            </div>

            <div className="space-y-3">
              {SERVICOS_VISIVEIS.map((s) => {
                const selectable = servicoSelecionavel(s);
                const active = services.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={active}
                    aria-disabled={!selectable}
                    disabled={!selectable}
                    onClick={() => selectable && toggleService(s.id)}
                    className={cn(
                      "w-full rounded-xl border-2 p-4 text-left transition-colors",
                      active
                        ? "border-forest bg-sage-100"
                        : selectable
                          ? "border-sage-200 hover:border-sage"
                          : "cursor-not-allowed border-sage-200 bg-surface-2 opacity-70"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-title font-bold text-ink">{s.nome}</span>
                      <span
                        className={cn(
                          "grid h-5 w-5 shrink-0 place-items-center rounded-md border",
                          active ? "border-forest bg-forest text-white" : "border-sage-200"
                        )}
                      >
                        {active && <Check className="h-3.5 w-3.5" />}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted">
                        Pago pelo {s.quemPaga === "inquilino" ? "inquilino" : "proprietário"}
                      </span>
                      {selectable ? (
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-900">
                          Disponível
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          <Clock className="h-3 w-3" /> Em breve
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-muted">{s.descricao}</p>
                  </button>
                );
              })}
            </div>

            {services.length > 0 && (
              <p className="rounded-lg bg-sage-100 px-3 py-2 text-xs text-forest">
                Serviços selecionados:{" "}
                <strong>
                  {SERVICOS_VISIVEIS.filter((s) => services.includes(s.id))
                    .map((s) => s.nome)
                    .join(", ")}
                </strong>
                .
              </p>
            )}
          </div>
        )}

        {/* ── 8.3 SEGURO PATRIMONIAL (opcional) ── */}
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

        {/* ── 8.4 CONTRATO + RATEIO ── */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-title text-lg font-bold text-ink">Contrato de locação por temporada</h2>
              <p className="mt-1 text-sm text-muted">
                Gerado e assinado digitalmente (validade jurídica · Lei 14.063/2020), art. 48
                da Lei 8.245/91.
              </p>
            </div>

            {/* Modelo selecionado por FAIXA DE PRAZO (Onda 1 — estrutura). */}
            <div className="rounded-xl border border-sage-200 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-ink">{MODELO_CONTRATO.titulo}</p>
                <span className="rounded-full bg-sage-100 px-2.5 py-1 text-xs font-medium text-forest">
                  Faixa {FAIXA_LABEL} · {FAIXA_RESUMO}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">
                Selecionado automaticamente pelo prazo ({STAY_DAYS} dias).{" "}
                {MODELO_CONTRATO.textoPendente && (
                  <span className="text-amber-700">Aguardando texto jurídico da advogada.</span>
                )}
              </p>
              <div className="mt-3">
                <p className="text-xs font-medium text-ink">Cláusulas a incluir (a redigir):</p>
                <ul className="mt-1.5 grid gap-1">
                  {CLAUSULAS_PLACEHOLDER.map((c) => (
                    <li key={c.key} className="flex gap-2 text-xs text-muted">
                      <span className="text-sage">•</span>
                      <span>
                        <strong className="text-ink">{c.titulo}:</strong> {c.nota}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
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
              <Row label="Prazo" value={`${prazoMeses} meses`} />
              <Row label="Aluguel" value={`${formatBRL(PROPERTY.monthlyRent)}/mês`} />
              <Row label="Garantia" value={selectedGarantia?.nome ?? "—"} />
            </div>

            {/* Regime de consumo no contrato (Atualização 6) */}
            <div className="rounded-xl border border-sage-200 p-4 text-sm">
              <p className="font-medium text-ink">Despesas de consumo</p>
              <p className="mt-1 text-muted">
                Regime: <strong>valor fixo estimado</strong> de {formatBRL(280)}/mês, com
                cláusula de ajuste se o consumo exceder 20%. A cobrança complementar (com
                comprovante) é registrada pela plataforma — não intermediada.
              </p>
            </div>

            {/* Taxa de preparação/limpeza (Bloco B) */}
            <div className="rounded-xl border border-sage-200 p-4 text-sm">
              <p className="font-medium text-ink">Limpeza & preparação</p>
              <div className="mt-2 space-y-1">
                <Row label="Preparação (limpeza profunda, única)" value={formatBRL(PREP_FEE)} />
                <Row label="Limpeza de saída (opcional)" value={formatBRL(CHECKOUT_FEE)} />
              </div>
              <p className="mt-2 text-xs text-muted">
                A preparação é cobrada <strong>uma única vez</strong> (não a cada hóspede). A
                taxa vai ao proprietário (despesa de preparação) — não é receita da plataforma.
              </p>
            </div>

            {/* Total que o inquilino vê no 1º pagamento */}
            <div className="rounded-xl bg-blue-50 p-4 text-sm">
              <p className="font-medium text-blue-900">O inquilino vê no 1º pagamento</p>
              <div className="mt-2 space-y-1">
                <Row label="Aluguel" value={`${formatBRL(PROPERTY.monthlyRent)}/mês`} />
                <Row label="Consumo estimado" value={`${formatBRL(280)}/mês`} />
                <Row label="Preparação (única)" value={formatBRL(PREP_FEE)} />
                <div className="flex items-center justify-between border-t border-blue-200 pt-1 font-bold text-blue-900">
                  <span>Total do 1º pagamento</span>
                  <span>{formatBRL(PROPERTY.monthlyRent + 280 + PREP_FEE)}</span>
                </div>
              </div>
            </div>

            {/* Comissão de fechamento (split sobre o 1º mês) */}
            <div className="rounded-xl border border-champagne/40 bg-champagne/10 p-4 text-sm">
              <p className="font-title font-bold text-forest">
                Comissão de fechamento · {Math.round(COMMISSION_RATE * 100)}% (plano Essencial)
              </p>
              <p className="mt-1 text-xs text-muted">
                Cobrada <strong>uma única vez por contrato-mãe</strong>, sobre 1 mês, no
                fechamento. Renovar ou estender blocos <strong>não gera nova comissão</strong>. Os
                aluguéis seguintes vão direto ao proprietário.
              </p>
              <div className="mt-3 space-y-1">
                <Row label="1º aluguel" value={formatBRL(PROPERTY.monthlyRent)} />
                <Row label="Comissão da plataforma" value={`− ${formatBRL(PLATFORM_COMMISSION)}`} />
                <div className="flex items-center justify-between border-t border-champagne/40 pt-1 font-medium text-forest">
                  <span>Líquido ao proprietário</span>
                  <span>{formatBRL(OWNER_NET)}</span>
                </div>
              </div>
              {/* Incentivo de upgrade (A7) */}
              <p className="mt-3 border-t border-champagne/40 pt-3 text-xs text-muted">
                Sua comissão é {Math.round(COMMISSION_RATE * 100)}% (plano Essencial). No plano{" "}
                <strong className="text-ink">Profissional</strong> seria{" "}
                {Math.round(COMMISSION_BY_PLAN.pro * 100)}%.{" "}
                <Link href="/dashboard/assinatura" className="font-medium text-blue-500 hover:text-blue-700">
                  Fazer upgrade →
                </Link>
              </p>
            </div>

            {generated ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-xl bg-sage-100 px-4 py-3 text-sm text-forest">
                  <FileCheck2 className="h-5 w-5" /> Contrato enviado para assinatura digital.
                </div>
                {signUrl && (
                  <a
                    href={signUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-forest underline"
                  >
                    Abrir documento para assinatura
                  </a>
                )}
                {/* Compartilhamento profissional (Atualização 17) */}
                <div className="pt-2">
                  <DocumentShare
                    docNumber={CONTRACT_NUMBER}
                    shareUrl={
                      typeof window !== "undefined"
                        ? `${window.location.origin}/dashboard/fechamento?doc=${CONTRACT_NUMBER}`
                        : `https://vivanomads.com.br/doc/${CONTRACT_NUMBER}`
                    }
                    summary={`Contrato de locação por temporada — ${TENANT.name} · ${PROPERTY.title} · ${formatBRL(PROPERTY.monthlyRent)}/mês`}
                  />
                </div>
              </div>
            ) : (
              <Button variant="gold" onClick={generateContract}>
                <FileSignature className="h-4 w-4" /> Gerar contrato para assinatura
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
              <Row
                label="Inquilino verificado"
                value={
                  cafResult
                    ? `${TRAFFIC_LIGHT_META[cafResult.light].emoji} ${TRAFFIC_LIGHT_META[cafResult.light].label}`
                    : "—"
                }
              />
              <Row label="Garantia" value={selectedGarantia?.nome ?? "—"} />
              <Row
                label="Serviços adicionais"
                value={
                  services.length > 0
                    ? SERVICOS_VISIVEIS.filter((s) => services.includes(s.id))
                        .map((s) => s.nome)
                        .join(", ")
                    : "Nenhum"
                }
              />
              <Row label="Seguro patrimonial" value={patrimonial ? "Contratado" : "Não contratado"} />
              <Row label="Contrato" value={generated ? "Enviado para assinatura" : "Pendente"} />
              <Row
                label={`Comissão (${Math.round(COMMISSION_RATE * 100)}%)`}
                value={`${formatBRL(PLATFORM_COMMISSION)} · líquido ao dono ${formatBRL(OWNER_NET)}`}
              />
            </div>
            <p className="rounded-lg bg-sage-100 px-3 py-2 text-left text-sm text-forest">
              ⭐ Ao fim da locação, você e o inquilino poderão se avaliar — construindo
              reputação na plataforma (Proprietário e Inquilino Verificados).
            </p>
            <PlatformLegalNotice className="text-left" />
          </div>
        )}

        {/* Navegação */}
        {step < 5 && (
          <div className="mt-6">
            {pendingReason && (
              <p className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <Info className="h-4 w-4 shrink-0" /> {pendingReason}
              </p>
            )}
            <div className="flex justify-between">
              <Button variant="ghost" onClick={back} disabled={step === 0}>
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
              <Button onClick={next} disabled={!canAdvance}>
                Continuar <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Panel>

          {step < 5 && <PlatformLegalNotice className="mt-4" />}
        </div>
      </div>
    </div>
  );
}

function CafLaudo({ result }: { result: CafResult }) {
  const meta = TRAFFIC_LIGHT_META[result.light];
  return (
    <div className={cn("rounded-xl p-5 ring-1", meta.tone, meta.ring)}>
      <div className="flex items-center gap-2">
        <span className="text-2xl">{meta.emoji}</span>
        <span className="font-title text-lg font-bold">Verificação de identidade — {meta.label}</span>
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
