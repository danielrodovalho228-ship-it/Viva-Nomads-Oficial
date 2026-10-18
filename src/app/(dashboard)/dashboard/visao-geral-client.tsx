"use client";

import { useEffect, useState } from "react";
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
  Wallet,
} from "lucide-react";
import { useViewMode, primeiroNomeExibicao } from "@/lib/roles";
import { getLatestDraft } from "@/lib/data/actions";
import { StatCard, Panel, EmptyState, PageTitle } from "@/components/dashboard/primitives";
import { PropertyRow } from "@/components/dashboard/property-row";
import { TenantOnboarding } from "@/components/dashboard/tenant-onboarding";
import { RoleWelcomeModal } from "@/components/dashboard/role-welcome-modal";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { useProperties } from "@/lib/use-properties";
import { checklistAnuncio, type ChecklistAnuncio } from "@/lib/anuncio/prontidao";
import { itensDoChecklist } from "@/lib/anuncio/checklist-compacto";
import type { ScoreAnuncio } from "@/lib/anuncio/score";
import { imoveisPublicados } from "@/lib/anuncio/publicados";
import { kpiInteressados } from "@/lib/painel/kpi-interessados";
import type { Property } from "@/lib/types";
import { useDashDemo, DemoBadge, useDisplayUser } from "@/lib/demo/demo-mode";
import { DEMO_PROPERTIES, DEMO_KPIS } from "@/lib/demo/seed";
import { coverPhoto } from "@/lib/media";
import { formatBRL } from "@/lib/utils";
import { textoVencimento } from "@/lib/propostas/regras";
import { ReadyToLiveBadge } from "@/components/ui/badge";

export interface PropostaAguardando {
  id: string;
  numero: string;
  imovel: string;
  validaAte: string;
}

export function VisaoGeral({
  imoveisDono,
  interessados = { atual: 0, anterior: 0 },
  propostasAguardando = [],
}: {
  imoveisDono: Property[];
  interessados?: { atual: number; anterior: number };
  propostasAguardando?: PropostaAguardando[];
}) {
  // Identidade de EXIBIÇÃO: nunca cai na persona demo ("Marcos") para conta real
  // com demo desligado (fronteira demo/real). Sem nome → "Olá!".
  const user = useDisplayUser();
  const { mode } = useViewMode();
  // Saudação com o primeiro nome do perfil; sem nome, saudação neutra — NUNCA o
  // e-mail cru (reteste QA item 4).
  const firstName = primeiroNomeExibicao(user);

  return (
    <>
      {/* Pergunta de papel no primeiro login (uma vez só). */}
      <RoleWelcomeModal />
      {mode === "tenant" ? <TenantDashboard name={firstName} propostas={propostasAguardando} /> : <OwnerDashboard name={firstName} imoveisDono={imoveisDono} interessados={interessados} />}
    </>
  );
}

function OwnerDashboard({
  name,
  imoveisDono,
  interessados,
}: {
  name: string;
  imoveisDono: Property[];
  interessados: { atual: number; anterior: number };
}) {
  // Fonte demo: build de demonstração OU modo demonstração do admin. Os dados
  // reais e o seed NUNCA se misturam — a fonte é uma ou outra.
  const demo = useDashDemo();
  // Só imóveis ATIVOS contam como "imóvel publicado" (regra única, a mesma de
  // "Meus imóveis"). Rascunhos não entram nos KPIs nem na lista da visão geral —
  // eles têm o próprio card de "anúncio em andamento" abaixo. A lista real já
  // chega do servidor: não há estado "carregando" que pareça "nenhum imóvel".
  const allProperties = imoveisPublicados(demo ? DEMO_PROPERTIES : imoveisDono);
  const myProperties = allProperties.slice(0, 2);
  const kpiLeads = kpiInteressados(interessados.atual, interessados.anterior, {
    temImovelPublicado: allProperties.length > 0,
  });

  // Rascunho em andamento (P0): card de pendência "continue de onde parou".
  const [draft, setDraft] = useState<RascunhoPendente | null>(null);
  useEffect(() => {
    if (demo) return;
    let alive = true;
    getLatestDraft()
      .then((d) => {
        // Prontidão da fonte única (a mesma de Meus imóveis e do Publicar).
        if (alive && d) setDraft({
          id: d.id,
          pct: d.prontidao?.pct ?? 0,
          pronto: !!d.prontidao?.podePublicar,
          faltam: d.prontidao?.faltam ?? [],
          checklist: d.prontidao ? checklistAnuncio(d.prontidao, d.id) : null,
          score: d.score,
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [demo]);

  // Estado vazio como FUNIL (Dashboard Fase 1): proprietário sem imóvel publicado
  // vê a visão geral inteira como um convite passo a passo, um CTA por vez —
  // nada de menus mortos ou cards zerados. Só depois do carregamento (sem piscar
  // o funil enquanto os imóveis reais chegam). No modo demo há exemplos.
  if (!demo && allProperties.length === 0) {
    return <OwnerFunnel name={name} draft={draft} />;
  }

  return (
    <>
      {draft && <DraftPendingCard draft={draft} className="mb-6" />}
      <PageTitle
        capa="imoveis"
        title={`Olá${name ? `, ${name}` : "!"} 👋`}
        subtitle="Prepare seu imóvel, publique e fale com inquilinos qualificados."
        action={
          <ButtonLink href="/dashboard/imoveis/novo" variant="accent">
            <ClipboardCheck className="h-4 w-4" /> Novo anúncio
          </ButtonLink>
        }
      />

      {/* Convite à verificação (sem progresso fabricado no modo real) */}
      <Panel className="mb-6 bg-forest text-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-title text-lg font-bold">
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
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-champagne px-4 py-2 text-sm font-semibold text-night transition-colors hover:bg-champagne-600"
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
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
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
        <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-forest" />
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
                      <p className="text-sm text-muted">
                        {formatBRL(p.monthlyPrice)}/mês · {p.neighborhood}
                      </p>
                      {/* Selos abaixo do título: em 390 px não espremem o texto. */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        {p.readyToLiveBadge && <ReadyToLiveBadge />}
                        <span className="rounded-full bg-sage-100 px-2.5 py-1 text-xs font-medium text-forest">
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
    </>
  );
}

/** "Você recebeu uma proposta — vence em 5 dias" (prompt 27, item 7). */
function CartaoPropostas({ propostas }: { propostas: PropostaAguardando[] }) {
  if (!propostas.length) return null;
  const primeira = propostas[0];
  const vence = textoVencimento(primeira.validaAte, new Date());
  const titulo =
    propostas.length === 1 ? `Você recebeu uma proposta — ${vence}` : `Você tem ${propostas.length} propostas para responder — a primeira ${vence}`;
  return (
    <Link
      href={propostas.length === 1 ? `/dashboard/propostas/${primeira.id}` : "/dashboard/propostas"}
      className="mb-5 flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 hover:border-amber-400"
      data-testid="cartao-proposta-recebida"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-amber-800">
        <FileSignature className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink">{titulo}</span>
        <span className="block truncate text-sm text-muted">
          {primeira.numero} · {primeira.imovel}
        </span>
      </span>
      <span className="shrink-0 text-sm font-medium text-forest underline">Responder</span>
    </Link>
  );
}

function TenantDashboard({ name, propostas }: { name: string; propostas: PropostaAguardando[] }) {
  const demo = useDashDemo();
  const recommended = useProperties("/api/properties").properties.slice(0, 3);
  return (
    <>
      {/* Título da tela (h1): sem ele a Visão geral do inquilino não tinha cabeçalho principal (varredura t48). */}
      <PageTitle title="Visão geral" subtitle="Candidaturas, favoritos, buscas salvas e mensagens num lugar só." />
      <CartaoPropostas propostas={propostas} />
      {/* Primeiro acesso: checklist de 3 passos (ou o banner, quando concluído/oculto). */}
      <TenantOnboarding name={name} />

      {/* KPIs de acesso rápido: 2×2 no mobile, 4 em linha no desktop. Candidaturas
          é o lar do acompanhamento (envio → resposta) — sem novo item no menu. */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-4">
        <StatCard label="Candidaturas" value={demo ? "2" : "0"} icon={FileSignature} href="/dashboard/candidaturas" />
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
            <ButtonLink href="/buscar" variant="primary">
              Explorar imóveis
            </ButtonLink>
          }
        />
      </div>
    </>
  );
}

/**
 * Estado vazio como FUNIL (Dashboard Fase 1). Proprietário sem imóvel publicado
 * vê um caminho único: Qualificar → Anunciar → Receber candidaturas, com UM CTA
 * ativo por vez. Sem menus mortos nem cards zerados.
 */
/** Card de pendência "Anúncio em andamento" (P0) — atalho para retomar o
 * rascunho de onde parou, com o % completo honesto. */
type RascunhoPendente = { id: string; pct: number; pronto: boolean; faltam: string[]; checklist: ChecklistAnuncio | null; score?: ScoreAnuncio | null };

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
    <div className={`rounded-2xl border border-champagne bg-champagne/10 p-4 ${className ?? ""}`} data-testid="anuncio-andamento">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-champagne/40 text-forest">
            <PencilLine className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-title text-sm font-bold text-ink">
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
            className={buttonClasses({ size: "sm" })}
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
            <span className="font-title font-bold text-forest" data-testid="anuncio-score-valor">{draft.score.score}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-champagne/40" role="progressbar" aria-valuenow={draft.score.score} aria-valuemin={0} aria-valuemax={100} aria-label="Qualidade do anúncio">
            <div className="h-full rounded-full bg-forest" style={{ width: `${draft.score.score}%` }} />
          </div>
          {draft.score.dicas.length > 0 && (
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2" data-testid="anuncio-score-dicas">
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
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2" data-testid="anuncio-checklist">
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
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
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

function OwnerFunnel({ name, draft }: { name: string; draft?: RascunhoPendente | null }) {
  const passos = [
    {
      n: 1,
      titulo: "Comece pelas fotos",
      texto: "Envie as fotos do imóvel; o restante do cadastro vem em seguida.",
      cta: "Cadastrar meu imóvel",
      href: "/dashboard/imoveis/novo",
      ativo: true,
    },
    {
      n: 2,
      titulo: "Publique o anúncio",
      texto: "Fotos, preço e disponibilidade — quanto mais completo, mais candidaturas.",
      cta: "Publicar anúncio",
      href: "/dashboard/imoveis/novo",
      ativo: false,
    },
    {
      n: 3,
      titulo: "Receba candidaturas e pedidos",
      texto: "Interessados chegam por candidatura ou pelos Pedidos de Moradia da sua cidade.",
      cta: "Ver pedidos de moradia",
      href: "/pedidos",
      ativo: false,
    },
    {
      n: 4,
      titulo: "Feche com segurança",
      texto: "Aceite o candidato e conclua contrato, caução e conferência de entrada pelo painel.",
      cta: "Ver fechamento",
      href: "/dashboard/fechamento",
      ativo: false,
    },
  ];

  return (
    <>
      {draft && <DraftPendingCard draft={draft} className="mb-6" />}
      <PageTitle
        capa="imoveis"
        title={`Bem-vindo${name ? `, ${name}` : ""}! 👋`}
        subtitle="Do primeiro anúncio ao contrato fechado em 4 passos."
        action={
          <ButtonLink href="/dashboard/imoveis/novo" variant="accent">
            <ClipboardCheck className="h-4 w-4" /> Começar agora
          </ButtonLink>
        }
      />

      <ol className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {passos.map((p) => (
          <li
            key={p.n}
            className={`flex h-full flex-col rounded-2xl border p-5 ${
              p.ativo ? "border-forest bg-white shadow-sm" : "border-line bg-surface-2"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`grid h-7 w-7 place-items-center rounded-full text-sm font-bold ${
                  p.ativo ? "bg-forest text-white" : "bg-white text-muted"
                }`}
              >
                {p.n}
              </span>
              <h3 className="font-title font-bold text-ink">{p.titulo}</h3>
            </div>
            <p className="mt-2 flex-1 text-sm text-muted">{p.texto}</p>
            {p.ativo ? (
              <ButtonLink href={p.href} variant="primary" className="mt-4 w-full justify-center">
                {p.cta} <ArrowRight className="h-4 w-4" />
              </ButtonLink>
            ) : (
              <p className="mt-4 text-xs font-medium text-muted">Depois do passo {p.n - 1}</p>
            )}
          </li>
        ))}
      </ol>

      <p className="mt-6 rounded-xl border border-sage-200 bg-white px-4 py-3 text-sm text-muted">
        A plataforma <strong className="text-ink">conecta, verifica, documenta e registra</strong> —
        você fecha direto com o inquilino. Precisa de ajuda para começar?{" "}
        <Link href="/como-funciona" className="web-only font-medium text-forest hover:underline">
          Veja como funciona
        </Link>
        .
      </p>
    </>
  );
}

function Activity({ text, time }: { text: string; time: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sage" />
      <div>
        <p className="text-ink">{text}</p>
        <p className="text-xs text-muted">{time}</p>
      </div>
    </li>
  );
}
