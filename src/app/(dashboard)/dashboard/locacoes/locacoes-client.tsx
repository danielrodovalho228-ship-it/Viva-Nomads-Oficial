"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Home, CircleDollarSign } from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import type { SeloEstadia } from "@/lib/data/locacoes-selo";
import { AvaliacaoForm } from "@/components/avaliacao-form";
import { useDemoMode, DemoBadge } from "@/lib/demo/demo-mode";
import { DEMO_CONTRACTS } from "@/lib/demo/seed";
import type { LocacaoView } from "@/lib/data/contratos-actions";
import type { documentosDosContratos } from "@/lib/data/documentos-actions";
import { ConfirmarPagamentos, DevolucaoCaucaoInquilino, ListaDocumentos } from "@/components/documentos/documentos-contrato";
import { formatBRL } from "@/lib/utils";
import { ROTULO_ETAPA } from "@/lib/contrato-etapas";

/** Locações de DEMONSTRAÇÃO (a partir do seed) para o piloto/testes. */
function buildDemoLocacoes(): LocacaoView[] {
  return DEMO_CONTRACTS.map((c, i) => ({
    id: `demo-loc-${i}`,
    propertyId: `demo-prop-${i}`,
    propertyTitle: c.imovel,
    ownerId: `demo-owner-${i}`,
    aluguelMensal: c.valorMes,
    status: "ativo",
    etapa: "em_vigencia",
    criadoEm: c.inicio,
    podeAvaliar: false,
    pagamentos: [],
  }));
}

export function LocacoesClient({
  locacoes: real,
  extras = {},
  selos = {},
}: {
  locacoes: LocacaoView[];
  extras?: Awaited<ReturnType<typeof documentosDosContratos>>;
  /** Selo do anfitrião por contrato (foto/iniciais + primeiro nome); sem entrada → "Sua estadia". */
  selos?: Record<string, SeloEstadia>;
}) {
  const { on: demoOn } = useDemoMode();
  const demoLocacoes = useMemo(() => buildDemoLocacoes(), []);
  const locacoes = demoOn ? demoLocacoes : real;

  return (
    <>
      <PageTitle capa="locacoes"
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
                  <h2 className="font-title text-lg font-bold text-ink">
                    {demoOn ? (
                      l.propertyTitle
                    ) : (
                      <Link href={`/dashboard/locacoes/${l.id}`} className="hover:underline" data-testid="locacao-titulo">
                        {l.propertyTitle}
                      </Link>
                    )}
                  </h2>
                  {!demoOn && (
                    <p
                      className="mt-1 inline-flex max-w-full items-center gap-1.5 text-xs font-medium text-forest"
                      data-testid="locacao-selo"
                      aria-label={selos[l.id] ? `Anfitrião: ${selos[l.id].rotulo}` : "Sua estadia"}
                    >
                      <Avatar name={selos[l.id]?.rotulo ?? "Sua estadia"} size={20} photoUrl={selos[l.id]?.fotoUrl ?? undefined} />
                      <span className="min-w-0 truncate">{selos[l.id]?.rotulo ?? "Sua estadia"}</span>
                    </p>
                  )}
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted">
                    <CircleDollarSign className="h-3.5 w-3.5" /> {formatBRL(l.aluguelMensal)}/mês
                  </p>
                </div>
                <span
                  className="rounded-full bg-sage-100 px-2.5 py-1 text-xs font-medium text-forest"
                  data-testid="locacao-etapa"
                >
                  {l.status === "ativo" ? ROTULO_ETAPA[l.etapa] : l.status}
                </span>
              </div>

              {/* Confirmar pagamentos → recibo; documentos; devolução da caução. */}
              {!demoOn && (
                <>
                  <ConfirmarPagamentos pagamentos={l.pagamentos} />
                  <DevolucaoCaucaoInquilino acerto={extras[l.id]?.acerto ?? null} />
                  <ListaDocumentos documentos={extras[l.id]?.documentos ?? []} recibos={extras[l.id]?.recibos ?? []} />
                </>
              )}

              {!demoOn && (
                <Link href={`/dashboard/locacoes/${l.id}`} className="mt-4 inline-block" data-testid="locacao-ver-contrato">
                  <Button variant={l.etapa === "aguardando_assinatura" ? "gold" : "outline"}>
                    {l.etapa === "aguardando_assinatura" && l.status === "ativo" ? "Ver e assinar contrato" : "Ver contrato"}
                  </Button>
                </Link>
              )}

              {/* Inquilino avalia o proprietário — só na janela de avaliação (fim da estadia). */}
              {(l.podeAvaliar || demoOn) && (
              <AvaliacaoForm
                contratoId={l.id}
                alvoId={l.ownerId}
                papelAutor="inquilino"
                abrirLabel="Avaliar o proprietário"
                titulo="Como foi sua experiência com este proprietário?"
                placeholder="Comentário (opcional) — comunicação, o imóvel como anunciado, suporte…"
                demo={demoOn}
              />
              )}
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
