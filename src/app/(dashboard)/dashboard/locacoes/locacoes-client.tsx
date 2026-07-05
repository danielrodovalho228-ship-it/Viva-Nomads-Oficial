"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Home, CircleDollarSign } from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { AvaliacaoForm } from "@/components/avaliacao-form";
import { useDemoMode, DemoBadge } from "@/lib/demo/demo-mode";
import { DEMO_CONTRACTS } from "@/lib/demo/seed";
import type { LocacaoView } from "@/lib/data/contratos-actions";
import { formatBRL } from "@/lib/utils";

/** Locações de DEMONSTRAÇÃO (a partir do seed) para o piloto/testes. */
function buildDemoLocacoes(): LocacaoView[] {
  return DEMO_CONTRACTS.map((c, i) => ({
    id: `demo-loc-${i}`,
    propertyId: `demo-prop-${i}`,
    propertyTitle: c.imovel,
    ownerId: `demo-owner-${i}`,
    aluguelMensal: c.valorMes,
    status: "ativo",
    criadoEm: c.inicio,
  }));
}

export function LocacoesClient({ locacoes: real }: { locacoes: LocacaoView[] }) {
  const { on: demoOn } = useDemoMode();
  const demoLocacoes = useMemo(() => buildDemoLocacoes(), []);
  const locacoes = demoOn ? demoLocacoes : real;

  return (
    <>
      <PageTitle
        title="Minhas locações"
        subtitle="Suas estadias e a avaliação do proprietário."
        action={demoOn ? <DemoBadge /> : undefined}
      />

      {locacoes.length === 0 ? (
        <EmptyState
          icon={Home}
          title="Você ainda não tem locações"
          text="Quando você fechar uma locação, ela aparece aqui — e você poderá avaliar o proprietário ao final da estadia."
          action={
            <Link href="/buscar">
              <Button variant="gold">Buscar imóveis</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-5">
          {locacoes.map((l) => (
            <Panel key={l.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-title text-lg font-bold text-ink">{l.propertyTitle}</h2>
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted">
                    <CircleDollarSign className="h-3.5 w-3.5" /> {formatBRL(l.aluguelMensal)}/mês
                  </p>
                </div>
                <span className="rounded-full bg-sage-100 px-2.5 py-1 text-xs font-medium text-forest">
                  {l.status === "ativo" ? "Ativa" : l.status}
                </span>
              </div>

              {/* Inquilino avalia o proprietário. */}
              <AvaliacaoForm
                contratoId={l.id}
                alvoId={l.ownerId}
                papelAutor="inquilino"
                abrirLabel="Avaliar o proprietário"
                titulo="Como foi sua experiência com este proprietário?"
                placeholder="Comentário (opcional) — comunicação, o imóvel como anunciado, suporte…"
                demo={demoOn}
              />
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
