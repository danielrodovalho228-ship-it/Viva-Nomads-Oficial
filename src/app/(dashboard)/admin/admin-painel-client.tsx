"use client";

import Link from "next/link";
import { Home, Users, FileSignature, Megaphone, ArrowRight } from "lucide-react";
import { PageTitle, Panel, StatCard } from "@/components/dashboard/primitives";
import type { ResumoAdmin } from "@/lib/data/admin-painel";

/**
 * Painel de admin. A fila de "checklists pendentes" saiu: a qualificação é
 * automática (elegível ou não) e o PORTÃO HUMANO é a conferência do documento
 * do imóvel, que tem fila própria em /admin/documentos.
 */
export function AdminPainelClient({ resumo, aviso }: { resumo: ResumoAdmin | null; aviso: string | null }) {
  return (
    <>
      <PageTitle title="Administração" subtitle="Números reais da plataforma e o que precisa da equipe." />

      {aviso && (
        <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {aviso}
        </p>
      )}

      <div className="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Usuários" value={resumo?.usuarios ?? "—"} icon={Users} />
        <StatCard label="Proprietários" value={resumo?.proprietarios ?? "—"} icon={Users} />
        <StatCard label="Inquilinos" value={resumo?.inquilinos ?? "—"} icon={Users} />
        <StatCard label="Imóveis ativos" value={resumo?.imoveisAtivos ?? "—"} icon={Home} />
        <StatCard label="Rascunhos" value={resumo?.imoveisRascunho ?? "—"} icon={Home} />
        <StatCard label="Pedidos ativos" value={resumo?.pedidosAtivos ?? "—"} icon={Megaphone} href="/admin/pedidos" />
      </div>

      <Panel title="Precisa da equipe">
        <Link
          href="/admin/documentos"
          className="flex items-center justify-between gap-4 rounded-xl border border-sage-200 px-4 py-3 hover:border-forest"
        >
          <span className="flex items-center gap-3">
            <FileSignature className="h-5 w-5 text-forest" />
            <span>
              <span className="block font-medium text-ink">Documentos de imóvel para conferir</span>
              <span className="block text-sm text-muted">Só documento aprovado libera a publicação do anúncio.</span>
            </span>
          </span>
          <span className="flex items-center gap-2 font-title text-lg font-bold text-forest">
            {resumo?.documentosPendentes ?? "—"} <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      </Panel>
    </>
  );
}
