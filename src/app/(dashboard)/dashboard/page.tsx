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
  FileSignature,
  Wallet,
} from "lucide-react";
import { useViewMode, primeiroNomeExibicao } from "@/lib/roles";
import { getLatestDraft } from "@/lib/data/actions";
import { draftCompletionPct } from "@/lib/draft-progress";
import { StatCard, Panel, EmptyState } from "@/components/dashboard/primitives";
import { DashboardBanner } from "@/components/dashboard/banner";
import { PropertyRow } from "@/components/dashboard/property-row";
import { TenantOnboarding } from "@/components/dashboard/tenant-onboarding";
import { RoleWelcomeModal } from "@/components/dashboard/role-welcome-modal";
import { ButtonLink } from "@/components/ui/button";
import { useProperties } from "@/lib/use-properties";
import { useDashDemo, DemoBadge, useDisplayUser } from "@/lib/demo/demo-mode";
import { DEMO_PROPERTIES, DEMO_KPIS } from "@/lib/demo/seed";
import { PHOTOS, coverPhoto } from "@/lib/media";
import { formatBRL } from "@/lib/utils";
import { ReadyToLiveBadge } from "@/components/ui/badge";

export default function DashboardPage() {
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
      {mode === "tenant" ? <TenantDashboard name={firstName} /> : <OwnerDashboard name={firstName} />}
    </>
  );
}

function OwnerDashboard({ name }: { name: string }) {
  // Fonte demo: build de demonstração OU modo demonstração do admin. Os dados
  // reais e o seed NUNCA se misturam — a fonte é uma ou outra.
  const demo = useDashDemo();
  const { properties: realProperties, loading } = useProperties("/api/properties/mine");
  // Só imóveis ATIVOS contam como "imóvel publicado". Rascunhos (status='draft')
  // não entram nos KPIs nem na lista "Meus imóveis" da visão geral — eles têm o
  // próprio card de "anúncio em andamento" abaixo.
  const allProperties = (demo ? DEMO_PROPERTIES : realProperties).filter((p) => p.status === "active");
  const myProperties = allProperties.slice(0, 2);

  // Rascunho em andamento (P0): card de pendência "continue de onde parou".
  const [draft, setDraft] = useState<{ id: string; pct: number } | null>(null);
  useEffect(() => {
    if (demo) return;
    let alive = true;
    getLatestDraft()
      .then((d) => {
        if (alive && d) setDraft({ id: d.id, pct: draftCompletionPct(d.data as never) });
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
  if (!demo && !loading && allProperties.length === 0) {
    return <OwnerFunnel name={name} draft={draft} />;
  }

  return (
    <>
      {draft && <DraftPendingCard draft={draft} className="mb-6" />}
      <DashboardBanner
        className="mb-6"
        image={PHOTOS.dashOwner}
        alt="Sala de apartamento mobiliado preparada para anúncio"
        title={`Olá${name ? `, ${name}` : "!"} 👋`}
        subtitle="Prepare seu imóvel, publique e fale com inquilinos qualificados."
        action={
          <ButtonLink href="/qualificar" variant="accent">
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
        <StatCard label="Interessados" value={demo ? String(DEMO_KPIS.leads) : "0"} icon={Users} />
        <StatCard label="Mensagens" value={demo ? String(DEMO_KPIS.mensagens) : "0"} icon={MessageSquare} />
        <StatCard label="Imóveis ativos" value={String(allProperties.length)} icon={Home} />
      </div>

      {/* Regra de ouro, dita com todas as letras onde o dono pensa em dinheiro. */}
      <p className="mt-4 flex items-start gap-2 rounded-xl border border-forest/20 bg-forest/5 px-4 py-3 text-sm text-ink">
        <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-forest" />
        <span>
          O aluguel vai do inquilino <strong>direto para a sua conta</strong> — a plataforma nunca
          toca no dinheiro.
        </span>
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Meus imóveis" className="lg:col-span-2">
          {myProperties.length === 0 ? (
            <p className="py-3 text-sm text-muted">
              Você ainda não publicou imóveis.{" "}
              <Link href="/qualificar" className="font-medium text-forest hover:underline">
                Publicar o primeiro →
              </Link>
            </p>
          ) : (
            <>
              <ul className="divide-y divide-sage-200">
                {myProperties.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Image
                        src={coverPhoto(p.id, p.photos)}
                        alt=""
                        width={56}
                        height={56}
                        className="h-14 w-14 shrink-0 rounded-xl object-cover"
                      />
                      <div className="min-w-0">
                        {/* Imóveis de demonstração não têm página real (/imoveis/demo-*
                            daria 404) — mostra como texto. Reais viram link. */}
                        {demo ? (
                          <span className="font-medium text-ink">{p.title}</span>
                        ) : (
                          <Link
                            href={`/imoveis/${p.id}`}
                            className="font-medium text-ink hover:text-forest"
                          >
                            {p.title}
                          </Link>
                        )}
                        <p className="text-sm text-muted">
                          {formatBRL(p.monthlyPrice)}/mês · {p.neighborhood}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.readyToLiveBadge && <ReadyToLiveBadge />}
                      <span className="rounded-full bg-sage-100 px-2.5 py-1 text-xs font-medium text-forest">
                        Ativo
                      </span>
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

function TenantDashboard({ name }: { name: string }) {
  const demo = useDashDemo();
  const recommended = useProperties("/api/properties").properties.slice(0, 3);
  return (
    <>
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
function DraftPendingCard({
  draft,
  className,
}: {
  draft: { id: string; pct: number };
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border border-champagne bg-champagne/10 p-4 sm:flex-row sm:items-center sm:justify-between ${className ?? ""}`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-champagne/40 text-forest">
          <PencilLine className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="font-title text-sm font-bold text-ink">
            Anúncio em andamento{draft.pct > 0 ? ` — ${draft.pct}% completo` : ""}
          </p>
          <p className="text-xs text-muted">Continue de onde parou. Seu rascunho está salvo.</p>
        </div>
      </div>
      <Link
        href={`/dashboard/imoveis/novo?draft=${draft.id}`}
        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-forest px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-forest/90"
      >
        Continuar edição <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function OwnerFunnel({ name, draft }: { name: string; draft?: { id: string; pct: number } | null }) {
  const passos = [
    {
      n: 1,
      titulo: "Qualifique seu imóvel",
      texto: "Um checklist rápido confirma que o imóvel está pronto para morar e define o selo.",
      cta: "Qualificar meu imóvel",
      href: "/qualificar",
      ativo: true,
    },
    {
      n: 2,
      titulo: "Publique o anúncio",
      texto: "Fotos, preço e disponibilidade — quanto mais completo, mais candidaturas.",
      cta: "Publicar anúncio",
      href: "/qualificar",
      ativo: false,
    },
    {
      n: 3,
      titulo: "Receba candidaturas e pedidos",
      texto: "Inquilinos verificados chegam por candidatura ou pelos Pedidos de Moradia da sua cidade.",
      cta: "Ver pedidos de moradia",
      href: "/pedidos",
      ativo: false,
    },
  ];

  return (
    <>
      {draft && <DraftPendingCard draft={draft} className="mb-6" />}
      <DashboardBanner
        className="mb-6"
        image={PHOTOS.dashOwner}
        alt="Sala de apartamento mobiliado preparada para anúncio"
        title={`Bem-vindo${name ? `, ${name}` : ""}! 👋`}
        subtitle="Vamos colocar seu primeiro imóvel no ar em 3 passos."
        action={
          <ButtonLink href="/qualificar" variant="accent">
            <ClipboardCheck className="h-4 w-4" /> Começar agora
          </ButtonLink>
        }
      />

      <ol className="grid gap-4 lg:grid-cols-3">
        {passos.map((p) => (
          <li
            key={p.n}
            className={`rounded-2xl border p-5 ${
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
            <p className="mt-2 text-sm text-muted">{p.texto}</p>
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
        <Link href="/como-funciona" className="font-medium text-forest hover:underline">
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
