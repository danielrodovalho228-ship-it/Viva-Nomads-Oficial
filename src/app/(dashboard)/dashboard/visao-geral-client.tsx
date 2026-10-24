"use client";

import { PrecoComContexto } from "@/components/preco/preco-com-contexto";
import { mesesDoCartao, rotuloPreco } from "@/lib/cartao-preco";
import { calcularTudoIncluido } from "@/lib/precos";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Eye,
  Users,
  MessageSquare,
  Home,
  Heart,
  Search,
  ClipboardCheck,
  ArrowRight,
  PencilLine,
  Check,
  Circle,
  FileSignature,
  FileText,
  FileX,
  KeyRound,
  Video,
  Wrench,
  ChevronRight,
  Wallet, BedDouble } from "lucide-react";
import { primeiroNomeExibicao } from "@/lib/roles";
import { StatCard, Panel, EmptyState, PageTitle } from "@/components/dashboard/primitives";
import { ConviteFotoPerfil } from "@/components/account/convite-foto-perfil";
import { PropertyRow } from "@/components/dashboard/property-row";
import { ChecklistAtivacaoBloco } from "@/components/onboarding/checklist-ativacao";
import type { ChecklistAtivacao } from "@/lib/onboarding/ativacao";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { useProperties } from "@/lib/use-properties";
import type { ChecklistAnuncio } from "@/lib/anuncio/prontidao";
import { itensDoChecklist } from "@/lib/anuncio/checklist-compacto";
import type { ScoreAnuncio } from "@/lib/anuncio/score";
import { imoveisPublicados } from "@/lib/anuncio/publicados";
import { kpiInteressados } from "@/lib/painel/kpi-interessados";
import type { Property } from "@/lib/types";
import { useDashDemo, DemoBadge, useDisplayUser } from "@/lib/demo/demo-mode";
import { DEMO_PROPERTIES, DEMO_KPIS } from "@/lib/demo/seed";
import { coverPhoto } from "@/lib/media";
import { cn } from "@/lib/utils";
import { juntarDecisoes, tituloDecisoes, type Decisao, type DecisaoDoPapel, type TipoDecisao } from "@/lib/painel/decisoes";
import { ReadyToLiveBadge } from "@/components/ui/badge";
import { ServicosPainel } from "@/components/parceiros/servicos-painel";
import type { EstadiaNaHome } from "@/lib/data/estadia";

/** Card de pendência "Anúncio em andamento" — o rascunho mais recente, lido no servidor (page.tsx). */
export type RascunhoPendente = { id: string; pct: number; pronto: boolean; faltam: string[]; checklist: ChecklistAnuncio | null; score?: ScoreAnuncio | null };

export function VisaoGeral({
  imoveisDono,
  interessados = { atual: 0, anterior: 0 },
  decisoesDono = [],
  decisoesMorador = [],
  rascunho = null,
  cidadePerfil = null,
  estadias = [],
  checklists = [],
  totalCandidaturas = 0,
}: {
  imoveisDono: Property[];
  interessados?: { atual: number; anterior: number };
  /** Prompt 42: "Hoje você tem N decisões" — montadas no servidor por lib/painel/decisoes.ts. */
  decisoesDono?: Decisao[];
  decisoesMorador?: Decisao[];
  rascunho?: RascunhoPendente | null;
  /** Prompt 32: estadias em vigor da pessoa, com o topo e a lista "Ações desta estadia". */
  estadias?: EstadiaNaHome[];
  /** Prompt 31a: cidade do perfil, para a busca de serviços de parceiros já preenchida. */
  cidadePerfil?: string | null;
  /** Prompt 43: checklist de ativação de cada papel que ainda não ativou (some sozinho). */
  checklists?: ChecklistAtivacao[];
  /** E72: quantas candidaturas a pessoa enviou — o tamanho da lista de /dashboard/candidaturas (listMinhasCandidaturas). */
  totalCandidaturas?: number;
}) {
  // Identidade de EXIBIÇÃO: nunca cai na persona demo ("Marcos") para conta real
  // com demo desligado (fronteira demo/real). Sem nome → "Olá!".
  const user = useDisplayUser();
  const demo = useDashDemo();
  // Primeiro nome do perfil; sem nome, neutro — NUNCA o e-mail cru (reteste QA item 4).
  const firstName = primeiroNomeExibicao(user);
  // Prompt 43 (conta única): o Início junta as decisões de todos os papéis, cada uma com o rótulo do papel. Sem "modo":
  // a parte de proprietário aparece para quem tem imóvel ou rascunho (ou entrou como dono); a de morador, sempre.
  const decisoes = demo ? [] : juntarDecisoes(decisoesDono, decisoesMorador);
  const ehDono = imoveisDono.length > 0 || !!rascunho || checklists.some((c) => c.papel === "proprietario") || demo;
  const semImovel = !demo && imoveisDono.length === 0 && !rascunho && checklists.some((c) => c.papel === "proprietario");
  const blocos = demo ? [] : checklists;

  return (
    <>
      <PageTitle
        title={tituloDecisoes(decisoes.length)}
        subtitle={decisoes.length ? "Toque para decidir na tela certa." : "Quando algo pedir sua resposta, aparece aqui."}
        action={
          ehDono && !semImovel ? (
            <ButtonLink href="/dashboard/imoveis/novo" variant="secondary">
              <ClipboardCheck className="h-4 w-4" /> Novo anúncio
            </ButtonLink>
          ) : undefined
        }
      />
      {/* Sem decisão, o checklist de ativação vem primeiro; havendo decisão, ela vem antes (adendo de onboarding). */}
      {decisoes.length === 0 && blocos.map((c) => <ChecklistAtivacaoBloco key={c.papel} checklist={c} />)}
      <ListaDecisoes decisoes={decisoes} />
      {decisoes.length > 0 && blocos.map((c) => <ChecklistAtivacaoBloco key={c.papel} checklist={c} />)}
      {!demo && <ConviteFotoPerfil className="mb-6" />}
      <CartaoEstadias estadias={estadias} />

      {ehDono && (
        <section aria-labelledby="papel-proprietario" className="mb-8" data-testid="inicio-proprietario">
          <h2 id="papel-proprietario" className="mb-3 font-title text-lg font-semibold text-ink">
            Como proprietário
          </h2>
          <OwnerDashboard imoveisDono={imoveisDono} interessados={interessados} rascunho={rascunho} cidade={cidadePerfil} semImovel={semImovel} />
        </section>
      )}
      <section aria-labelledby="papel-morador" data-testid="inicio-morador">
        <h2 id="papel-morador" className="mb-3 font-title text-lg font-semibold text-ink">
          Como morador
        </h2>
        <TenantDashboard name={firstName} cidade={ehDono ? null : cidadePerfil} totalCandidaturas={totalCandidaturas} />
      </section>
    </>
  );
}

function OwnerDashboard({
  imoveisDono,
  interessados,
  rascunho,
  cidade,
  semImovel,
}: {
  imoveisDono: Property[];
  interessados: { atual: number; anterior: number };
  rascunho: RascunhoPendente | null;
  cidade: string | null;
  semImovel: boolean;
}) {
  // Fonte demo: build de demonstração OU modo demonstração do admin. Os dados
  // reais e o seed NUNCA se misturam — a fonte é uma ou outra.
  const demo = useDashDemo();
  // Só imóveis ATIVOS contam como "imóvel publicado" (regra única, a mesma de
  // "Meus imóveis"). Rascunhos não entram nos KPIs nem na lista da visão geral —
  // eles têm o próprio card de "anúncio em andamento" abaixo.
  const allProperties = imoveisPublicados(demo ? DEMO_PROPERTIES : imoveisDono);
  const myProperties = allProperties.slice(0, 2);
  const kpiLeads = kpiInteressados(interessados.atual, interessados.anterior, {
    temImovelPublicado: allProperties.length > 0,
  });
  // Rascunho em andamento (P0): card de pendência "continue de onde parou" (lido no servidor; nada no modo demo).
  const draft = demo ? null : rascunho;

  return (
    <>
      {draft && <DraftPendingCard draft={draft} className="mb-6" />}
      {semImovel && <PrimeiroImovel />}
      {allProperties.length > 0 && <PainelDoDono demo={demo} allProperties={allProperties} myProperties={myProperties} kpiLeads={kpiLeads} cidade={cidade} />}
    </>
  );
}

/** Conta nova (sem imóvel): o único botão primário da tela. */
function PrimeiroImovel() {
  return (
    <Panel className="mb-6" data-testid="primeiro-imovel">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-title text-lg font-semibold text-ink">Seu primeiro anúncio</h2>
          <p className="mt-1 text-sm text-muted">Comece pelo endereço e pelas fotos. O rascunho fica salvo e você continua quando quiser.</p>
        </div>
        <ButtonLink href="/dashboard/imoveis/novo" variant="primary" className="w-full sm:w-auto">
          Cadastrar meu imóvel <ArrowRight className="h-4 w-4" />
        </ButtonLink>
      </div>
    </Panel>
  );
}

/** Métricas, verificação, "Meus imóveis" e atividade — para quem já tem imóvel publicado. */
function PainelDoDono({
  demo,
  allProperties,
  myProperties,
  kpiLeads,
  cidade,
}: {
  demo: boolean;
  allProperties: Property[];
  myProperties: Property[];
  kpiLeads: ReturnType<typeof kpiInteressados>;
  cidade: string | null;
}) {
  return (
    <>
      {/* Convite à verificação (sem progresso fabricado no modo real) */}
      <Panel className="mb-6 bg-forest text-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-title text-lg font-semibold">
              {demo ? "Verificação do perfil: 60%" : "Verifique seu perfil"}
            </h2>
            <p className="text-sm text-white/70">
              Complete a verificação para gerar mais confiança nos inquilinos.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
            {demo && (
              <div className="h-3 w-full max-w-xs overflow-hidden rounded-full bg-white/20 sm:w-64">
                <div className="h-full w-[60%] rounded-full bg-champagne" />
              </div>
            )}
            <Link
              href="/dashboard/verificacao"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-champagne px-4 py-2 text-sm font-semibold text-night transition-colors hover:bg-champagne-600"
            >
              {demo ? "Continuar verificação" : "Iniciar verificação"} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </Panel>

      {demo && (
        <div className="mb-2">
          <DemoBadge />
        </div>
      )}
      {/* Mobile: 4 KPIs em grade 2×2 compacta (ADENDO item 1/5). */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Visualizações"
          value={demo ? DEMO_KPIS.visualizacoes.toLocaleString("pt-BR") : "0"}
          icon={Eye}
        />
        {demo ? (
          <StatCard label="Interessados" value={String(DEMO_KPIS.leads)} icon={Users} />
        ) : (
          <StatCard
            label={kpiLeads.rotulo}
            value={kpiLeads.valor}
            hint={kpiLeads.dica}
            href={kpiLeads.href}
            icon={Users}
          />
        )}
        <StatCard label="Mensagens" value={demo ? String(DEMO_KPIS.mensagens) : "0"} icon={MessageSquare} />
        <StatCard label="Imóveis ativos" value={String(allProperties.length)} icon={Home} />
      </div>

      {/* Regra de ouro, dita com todas as letras onde o dono pensa em dinheiro. */}
      <p className="mt-4 flex items-start gap-2 rounded-xl border border-forest/20 bg-forest/5 px-4 py-3 text-sm text-ink">
        <Wallet className="mt-1 h-4 w-4 shrink-0 text-forest" />
        <span>
          O valor mensal vai <strong>direto para a sua conta</strong> — a plataforma nunca
          toca no dinheiro.
        </span>
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Meus imóveis">
          {myProperties.length === 0 ? (
            <p className="py-3 text-sm text-muted">
              Você ainda não publicou imóveis.{" "}
              <Link href="/dashboard/imoveis/novo" className="font-medium text-forest hover:underline">
                Publicar o primeiro →
              </Link>
            </p>
          ) : (
            <>
              <ul className="divide-y divide-sage-200">
                {myProperties.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-3">
                    <Image
                      src={coverPhoto(p.id, p.photos)}
                      alt=""
                      width={56}
                      height={56}
                      className="h-14 w-14 shrink-0 rounded-xl object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      {/* Imóveis de demonstração não têm página real (/imoveis/demo-*
                          daria 404) — mostra como texto. Reais viram link. */}
                      {demo ? (
                        <span className="line-clamp-2 font-medium text-ink">{p.title}</span>
                      ) : (
                        <Link
                          href={`/imoveis/${p.id}`}
                          className="line-clamp-2 font-medium text-ink hover:text-forest"
                        >
                          {p.title}
                        </Link>
                      )}
                      <PrecoComContexto
                        rotulo={rotuloPreco({ mensal: calcularTudoIncluido(p).total, meses: mesesDoCartao(undefined, p.minPeriodDays), disponivelEm: p.availableFrom })}
                        destaque="sm"
                      />
                      <p className="text-sm text-muted">{p.neighborhood}</p>
                      {/* Selos abaixo do título: em 390 px não espremem o texto. */}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {p.readyToLiveBadge && <ReadyToLiveBadge />}
                        <span className="rounded-full bg-sage-100 px-3 py-1 text-xs font-medium text-forest">
                          Ativo
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <Link
                href="/dashboard/imoveis"
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-forest hover:text-blue-700"
              >
                Ver todos <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          )}
        </Panel>

        <Panel title="Atividade recente">
          {demo ? (
            <ul className="space-y-4 text-sm">
              <Activity text="Nova consulta no Studio Centro" time="há 2 horas" />
              <Activity text="Imóvel Santa Mônica recebeu o selo Pronto para Morar" time="ontem" />
              <Activity text="3 novas visualizações" time="ontem" />
            </ul>
          ) : (
            <p className="py-3 text-sm text-muted">Sem atividade recente ainda.</p>
          )}
        </Panel>
      </div>
      <ServicosPainel cidade={allProperties[0]?.city || cidade} />
    </>
  );
}

const ICONE_DECISAO: Record<TipoDecisao, React.ComponentType<{ className?: string }>> = {
  contrato: FileSignature,
  proposta: FileText,
  manutencao: Wrench,
  conforto: BedDouble,
  estadia: KeyRound,
  visita: Video,
  documento: FileX,
  candidatura: Users,
};

/**
 * "Hoje você tem N decisões" (Prompt 42, item 1): uma linha por decisão — ícone, a coisa concreta, o prazo quando há —
 * e a linha inteira é o link para a tela onde se decide. Nada é decidido aqui.
 */
function ListaDecisoes({ decisoes }: { decisoes: (Decisao | DecisaoDoPapel)[] }) {
  if (!decisoes.length) return null;
  return (
    <ul className="mb-6 space-y-2" data-testid="lista-decisoes">
      {decisoes.map((d) => {
        const Icone = ICONE_DECISAO[d.tipo];
        return (
          <li key={d.id}>
            <Link
              href={d.href}
              data-testid="decisao"
              data-tipo={d.tipo}
              data-decisao={d.id}
              data-papel={"papel" in d ? d.papel : undefined}
              className="flex min-h-14 items-center gap-3 rounded-xl border border-sage-200 bg-white p-4 transition-colors hover:border-sage"
            >
              <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", d.atrasada ? "bg-red-50 text-red-700" : "bg-sage-100 text-forest")}>
                <Icone className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink [overflow-wrap:anywhere]">{d.texto}</span>
                {"papel" in d && (
                  <span className="text-xs text-muted" data-testid="decisao-papel">
                    {d.papel === "proprietario" ? "Proprietário" : "Morador"}
                  </span>
                )}
                {d.prazoTexto && (
                  <span className={cn("block text-sm", d.atrasada ? "text-red-700" : "text-muted")} data-testid="decisao-prazo">
                    {d.atrasada ? `Atrasada · ${d.prazoTexto}` : d.prazoTexto}
                  </span>
                )}
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * As estadias em vigor (Prompt 32): o topo de cada uma e a lista "Ações desta estadia" (a mesma da folha do 41). O que
 * a pessoa decide nelas entra na lista de decisões acima (Prompt 42) — aqui não se repete.
 */
function CartaoEstadias({ estadias }: { estadias: EstadiaNaHome[] }) {
  if (!estadias.length) return null;
  return (
    <Panel title="Suas estadias" className="mb-4" data-testid="home-decisoes-estadias">
      <ul className="divide-y divide-sage-200">
        {estadias.map((e) => (
          <li key={e.contratoId} className="py-3 first:pt-0 last:pb-0" data-testid="home-estadia" data-contrato={e.contratoId}>
            <Link href={`/dashboard/estadia/${e.contratoId}`} className="block min-w-0 hover:underline">
              <span className="block truncate font-semibold text-ink">{e.imovel}</span>
              <span className="block text-sm text-muted">{e.topo}</span>
            </Link>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1" data-testid="home-estadia-acoes">
              {e.acoes.map((a) => (
                <Link key={a.id} href={a.href} className="text-xs text-muted underline hover:text-ink">
                  {a.rotulo}
                </Link>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function TenantDashboard({ name, cidade, totalCandidaturas }: { name: string; cidade: string | null; totalCandidaturas: number }) {
  const demo = useDashDemo();
  const recommended = useProperties("/api/properties").properties.slice(0, 3);
  void name;
  return (
    <>
      {/* KPIs de acesso rápido: 2×2 no mobile, 4 em linha no desktop. Candidaturas
          é o lar do acompanhamento (envio → resposta) — sem novo item no menu. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatCard label="Candidaturas" value={demo ? "2" : String(totalCandidaturas)} icon={FileSignature} href="/dashboard/candidaturas" />
        <StatCard label="Favoritos" value={demo ? "3" : "0"} icon={Heart} href="/dashboard/favoritos" />
        <StatCard label="Buscas salvas" value={demo ? "2" : "0"} icon={Search} href="/dashboard/buscas" />
        <StatCard label="Mensagens" value={demo ? "1" : "0"} icon={MessageSquare} href="/dashboard/mensagens" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Imóveis recomendados">
          <div className="divide-y divide-sage-200">
            {recommended.map((p) => (
              <PropertyRow
                key={p.id}
                id={p.id}
                title={p.title}
                monthlyPrice={p.monthlyPrice}
                totalMes={calcularTudoIncluido(p).total}
                minPeriodDays={p.minPeriodDays}
                availableFrom={p.availableFrom}
                neighborhood={p.neighborhood}
                photos={p.photos}
              />
            ))}
          </div>
        </Panel>
        <EmptyState
          icon={Heart}
          title="Salve seus favoritos"
          text="Conforme você navega, salve os imóveis que mais gostou para comparar depois."
          action={
            <ButtonLink href="/buscar" variant="secondary">
              Explorar imóveis
            </ButtonLink>
          }
        />
      </div>
      {cidade !== null && <ServicosPainel cidade={cidade} />}
    </>
  );
}

/** Card de pendência "Anúncio em andamento" (P0) — atalho para retomar o
 * rascunho de onde parou, com o % completo honesto. */
function DraftPendingCard({
  draft,
  className,
}: {
  draft: RascunhoPendente;
  className?: string;
}) {
  const check = !draft.pronto ? draft.checklist : null;
  const [expandido, setExpandido] = useState(false);
  const lista = check ? itensDoChecklist(check.itens, expandido) : null;
  return (
    <div className={`rounded-xl border border-champagne bg-champagne/10 p-4 ${className ?? ""}`} data-testid="anuncio-andamento">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-champagne/40 text-forest">
            <PencilLine className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-title text-sm font-semibold text-ink">
              {draft.pronto ? "Anúncio 100% · pronto para publicar" : `Anúncio em andamento${draft.pct > 0 ? ` — ${draft.pct}% completo` : ""}`}
            </p>
            <p className="text-xs text-muted" data-testid="prontidao-visao-geral">
              {draft.pronto
                ? "Tudo o que é obrigatório está feito. Abra e toque em Publicar."
                : check?.proximo
                  ? `Próximo passo: ${check.proximo.label}`
                  : draft.faltam.length
                    ? `Falta para publicar: ${draft.faltam.join(" · ")}`
                    : "Continue de onde parou. Seu rascunho está salvo."}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-1 sm:items-end">
          <Link
            href={check?.proximo?.href ?? `/dashboard/imoveis/novo?draft=${draft.id}`}
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            {draft.pronto ? "Revisar e publicar" : check?.proximo ? "Fazer o próximo passo" : "Continuar edição"} <ArrowRight className="h-4 w-4" />
          </Link>
          {check?.proximo && (
            <Link
              href={`/dashboard/imoveis/novo?draft=${encodeURIComponent(draft.id)}`}
              data-testid="retomar-rascunho"
              className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-forest underline-offset-2 hover:underline"
            >
              Continuar de onde parou
            </Link>
          )}
        </div>
      </div>
      {draft.score && (
        <div className="mt-3" data-testid="anuncio-score">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium text-ink">Qualidade do anúncio</span>
            <span className="font-title font-semibold text-forest" data-testid="anuncio-score-valor">{draft.score.score}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-champagne/40" role="progressbar" aria-valuenow={draft.score.score} aria-valuemin={0} aria-valuemax={100} aria-label="Qualidade do anúncio">
            <div className="h-full rounded-full bg-forest" style={{ width: `${draft.score.score}%` }} />
          </div>
          {draft.score.dicas.length > 0 && (
            <ul className="mt-2 grid gap-2 sm:grid-cols-2" data-testid="anuncio-score-dicas">
              {draft.score.dicas.slice(0, 4).map((d) => (
                <li key={d.key}>
                  <Link
                    href={`/dashboard/imoveis/novo?draft=${encodeURIComponent(draft.id)}&etapa=${d.etapa}`}
                    data-testid="score-dica"
                    className="flex min-h-11 items-center gap-2 rounded-xl border border-transparent px-2 text-sm font-medium text-forest hover:bg-champagne/30"
                  >
                    <span className="min-w-0">{d.label}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted">+{d.pontos}</span>
                    <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {check && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2" data-testid="anuncio-checklist">
          {lista?.visiveis.map((i) => (
            <li key={i.key}>
              {i.ok ? (
                <span className="flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm text-ink" data-testid="check-feito">
                  <Check className="h-4 w-4 shrink-0 text-forest" aria-hidden /> <span>{i.label}</span>
                  <span className="sr-only"> — feito</span>
                </span>
              ) : i.acoes ? (
                <div className="rounded-xl border border-forest bg-champagne/30 p-2" data-testid="check-vaga">
                  <span className="flex items-start gap-2 text-sm font-medium text-forest">
                    <Circle className="mt-1 h-4 w-4 shrink-0 text-muted" aria-hidden />
                    <span className="min-w-0">
                      {i.label}
                      {i.detalhe && <span className="block text-xs font-normal text-muted">{i.detalhe}</span>}
                    </span>
                  </span>
                  <span className="mt-2 flex flex-wrap gap-2">
                    {i.acoes.map((a) => (
                      <Link key={a.href} href={a.href} className={buttonClasses({ size: "sm", variant: "outline" })}>
                        {a.label}
                      </Link>
                    ))}
                  </span>
                </div>
              ) : (
                <Link
                  href={i.href}
                  data-testid="check-falta"
                  className={`flex min-h-11 items-center gap-2 rounded-xl border px-2 text-sm font-medium text-forest hover:bg-champagne/30 ${i.key === check.proximo?.key ? "border-forest bg-champagne/30" : "border-transparent"}`}
                >
                  <Circle className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                  <span className="min-w-0">
                    {i.label}
                    {i.detalhe && <span className="block text-xs font-normal text-muted">{i.detalhe}</span>}
                  </span>
                  <ArrowRight className="ml-auto h-4 w-4 shrink-0" aria-hidden />
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
      {check && (lista?.ocultos ?? 0) > 0 && (
        <button
          type="button"
          data-testid="checklist-ver-todos"
          onClick={() => setExpandido(true)}
          className="mt-2 inline-flex min-h-11 items-center px-2 text-sm font-medium text-forest underline-offset-2 hover:underline"
        >
          Ver todos os itens ({lista?.ocultos} a mais)
        </button>
      )}
      {check && expandido && (
        <button
          type="button"
          onClick={() => setExpandido(false)}
          className="mt-2 inline-flex min-h-11 items-center px-2 text-sm font-medium text-forest underline-offset-2 hover:underline"
        >
          Mostrar menos
        </button>
      )}
    </div>
  );
}

function Activity({ text, time }: { text: string; time: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-sage" />
      <div>
        <p className="text-ink">{text}</p>
        <p className="text-xs text-muted">{time}</p>
      </div>
    </li>
  );
}
