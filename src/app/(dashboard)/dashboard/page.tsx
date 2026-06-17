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
import { useAuthStore } from "@/lib/store";
import { PageTitle, StatCard, Panel, EmptyState } from "@/components/dashboard/primitives";
import { ButtonLink } from "@/components/ui/button";
import { SAMPLE_PROPERTIES } from "@/lib/properties";
import { formatBRL } from "@/lib/utils";
import { WorkReadyBadge } from "@/components/ui/badge";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? "owner";
  const firstName = user?.name?.split(" ")[0] ?? "visitante";

  if (role === "tenant") return <TenantDashboard name={firstName} />;
  return <OwnerDashboard name={firstName} />;
}

function OwnerDashboard({ name }: { name: string }) {
  const myProperties = SAMPLE_PROPERTIES.slice(0, 2);

  return (
    <>
      <PageTitle
        title={`Olá, ${name} 👋`}
        subtitle="Aqui está o resumo dos seus anúncios."
        action={
          <ButtonLink href="/qualificar" variant="gold">
            <ClipboardCheck className="h-4 w-4" /> Novo anúncio
          </ButtonLink>
        }
      />

      {/* Progresso de verificação */}
      <Panel className="mb-6 bg-forest text-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-title text-lg font-bold">Verificação do perfil: 60%</h2>
            <p className="text-sm text-white/70">
              Complete a verificação para gerar mais confiança nos inquilinos.
            </p>
          </div>
          <div className="h-3 w-full max-w-xs overflow-hidden rounded-full bg-white/20">
            <div className="h-full w-[60%] rounded-full bg-champagne" />
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Visualizações" value="1.248" icon={Eye} />
        <StatCard label="Leads" value="12" icon={Users} />
        <StatCard label="Mensagens" value="5" icon={MessageSquare} />
        <StatCard label="Imóveis ativos" value="2" icon={Home} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Meus imóveis" className="lg:col-span-2">
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
                  {p.workReadyBadge && <WorkReadyBadge />}
                  <span className="rounded-full bg-sage-100 px-2.5 py-1 text-xs font-medium text-forest">
                    Ativo
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <Link
            href="/dashboard/imoveis"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-forest hover:text-champagne-600"
          >
            Ver todos <ArrowRight className="h-4 w-4" />
          </Link>
        </Panel>

        <Panel title="Atividade recente">
          <ul className="space-y-4 text-sm">
            <Activity text="Nova consulta no Studio Centro" time="há 2 horas" />
            <Activity text="Imóvel Santa Mônica recebeu o selo Pronto para Trabalho" time="ontem" />
            <Activity text="3 novas visualizações" time="ontem" />
          </ul>
        </Panel>
      </div>
    </>
  );
}

function TenantDashboard({ name }: { name: string }) {
  return (
    <>
      <PageTitle
        title={`Olá, ${name} 👋`}
        subtitle="Encontre o imóvel certo para a sua próxima fase."
        action={
          <ButtonLink href="/buscar" variant="gold">
            <Search className="h-4 w-4" /> Buscar imóveis
          </ButtonLink>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Favoritos" value="3" icon={Heart} />
        <StatCard label="Buscas salvas" value="2" icon={Search} />
        <StatCard label="Mensagens" value="1" icon={MessageSquare} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Imóveis recomendados">
          <ul className="divide-y divide-sage-200">
            {SAMPLE_PROPERTIES.slice(0, 3).map((p) => (
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
