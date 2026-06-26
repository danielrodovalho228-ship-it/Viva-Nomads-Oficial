"use client";

import Link from "next/link";
import {
  Eye,
  Users,
  MessageSquare,
  Home,
  Heart,
  Search,
  ClipboardCheck,
  ArrowRight,
} from "lucide-react";
import { useAuthStore, DEMO_USER } from "@/lib/store";
import { useViewMode } from "@/lib/roles";
import { StatCard, Panel, EmptyState } from "@/components/dashboard/primitives";
import { DashboardBanner } from "@/components/dashboard/banner";
import { ButtonLink } from "@/components/ui/button";
import { useProperties } from "@/lib/use-properties";
import { isSupabaseConfigured } from "@/lib/env";
import { PHOTOS } from "@/lib/media";
import { formatBRL } from "@/lib/utils";
import { ReadyToLiveBadge } from "@/components/ui/badge";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user) ?? DEMO_USER;
  const { mode } = useViewMode();
  // Saudação com o nome real; sem nome coletado, cai em "Olá!" — nunca
  // "visitante" nem a parte local do e-mail (pré-lançamento, ALTA 3).
  const firstName = user.fullName?.trim() ? user.fullName.trim().split(" ")[0] : "";

  if (mode === "tenant") return <TenantDashboard name={firstName} />;
  return <OwnerDashboard name={firstName} />;
}

function OwnerDashboard({ name }: { name: string }) {
  const demo = !isSupabaseConfigured();
  const allProperties = useProperties("/api/properties/mine").properties;
  const myProperties = allProperties.slice(0, 2);

  return (
    <>
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Visualizações" value={demo ? "1.248" : "0"} icon={Eye} />
        <StatCard label="Leads" value={demo ? "12" : "0"} icon={Users} />
        <StatCard label="Mensagens" value={demo ? "5" : "0"} icon={MessageSquare} />
        <StatCard
          label="Imóveis ativos"
          value={demo ? "2" : String(allProperties.length)}
          icon={Home}
        />
      </div>

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
                    <div>
                      <Link
                        href={`/imoveis/${p.id}`}
                        className="font-medium text-ink hover:text-forest"
                      >
                        {p.title}
                      </Link>
                      <p className="text-sm text-muted">
                        {formatBRL(p.monthlyPrice)}/mês · {p.neighborhood}
                      </p>
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
  const demo = !isSupabaseConfigured();
  const recommended = useProperties("/api/properties").properties.slice(0, 3);
  return (
    <>
      <DashboardBanner
        className="mb-6"
        image={PHOTOS.dashTenant}
        alt="Canto aconchegante de apartamento mobiliado com luz da manhã"
        title={`Olá${name ? `, ${name}` : "!"} 👋`}
        subtitle="Encontre o imóvel certo para a sua próxima fase."
        action={
          <ButtonLink href="/buscar" variant="accent">
            <Search className="h-4 w-4" /> Buscar imóveis
          </ButtonLink>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Favoritos" value={demo ? "3" : "0"} icon={Heart} />
        <StatCard label="Buscas salvas" value={demo ? "2" : "0"} icon={Search} />
        <StatCard label="Mensagens" value={demo ? "1" : "0"} icon={MessageSquare} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Imóveis recomendados">
          <ul className="divide-y divide-sage-200">
            {recommended.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-3">
                <Link href={`/imoveis/${p.id}`} className="text-sm font-medium text-ink hover:text-forest">
                  {p.title}
                </Link>
                <span className="text-sm font-semibold text-forest">
                  {formatBRL(p.monthlyPrice)}
                </span>
              </li>
            ))}
          </ul>
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
