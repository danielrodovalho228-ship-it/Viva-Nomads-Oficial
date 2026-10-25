"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ShieldCheck, ChevronRight } from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { useDemoMode, DemoBadge } from "@/lib/demo/demo-mode";
import { DEMO_CONTRACTS } from "@/lib/demo/seed";
import type { ContratoView } from "@/lib/data/contratos-actions";
import { formatBRL } from "@/lib/utils";
import { estadoCaucao } from "@/lib/caucao-estado";
import { PERC_CAUCAO_BLOCO } from "@/lib/contrato-blocos";
import { ROTULO_VER_CONTRATO, linhasCaucaoPorBloco, type ContratoParaCaucao, type LinhaCaucaoBloco } from "@/lib/contratos/area-dono";

/** Cauções de DEMONSTRAÇÃO: um bloco por contrato do seed (a segunda ainda a receber). */
function demoContratos(): ContratoParaCaucao[] {
  return DEMO_CONTRACTS.map((c, i) => {
    const blocos = [{ id: `demo-b-${i}`, numeroBloco: 1, caucao: c.caucao, caucaoForma: "avista", caucaoStatus: i === 1 ? "pendente" : "comprovada" }];
    return { id: `demo-${i}`, propertyTitle: c.imovel, blocos, pagamentos: [], caucao: estadoCaucao({ blocos, pagamentos: [] }) };
  });
}

/**
 * PROP-5 — Caução: só a caução por bloco (valor, forma, status e devolução), cada linha com "Ver contrato". O cartão do
 * contrato mora só em Contratos. O status vem da função única estadoCaucao (a mesma dos Contratos e do morador).
 */
export function GarantiasClient({ contratos }: { contratos: ContratoView[] }) {
  const { on: demoOn } = useDemoMode();
  const linhas = useMemo(() => linhasCaucaoPorBloco(demoOn ? demoContratos() : contratos), [demoOn, contratos]);

  return (
    <>
      <PageTitle title="Caução" subtitle="A caução de cada bloco dos seus contratos: valor, forma, status e devolução." action={demoOn ? <DemoBadge /> : undefined} />

      {linhas.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nenhuma caução ainda"
          text="Quando você fechar um contrato com caução, cada bloco aparece aqui com o status."
          action={
            <Link href="/dashboard/contratos" className="text-sm font-medium text-forest underline">
              Ver contratos
            </Link>
          }
        />
      ) : (
        <Panel className="p-0" data-testid="caucao-blocos">
          {/* Computador: tabela. Celular: uma linha por bloco, empilhada. */}
          <table className="hidden w-full text-left text-sm md:table">
            <thead className="border-b border-line text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Imóvel e bloco</th>
                <th className="px-4 py-3 font-semibold">Valor</th>
                <th className="px-4 py-3 font-semibold">Forma</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Devolução</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {linhas.map((l) => (
                <tr key={l.chave} data-testid="caucao-bloco" data-chave={l.chaveStatus}>
                  <td className="px-4 py-3">
                    <span className="block font-semibold text-ink">{l.imovel}</span>
                    <span className="block text-xs text-muted">Bloco {l.bloco}</span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-ink">{formatBRL(l.valor)}</td>
                  <td className="px-4 py-3 text-ink">{l.forma}</td>
                  <td className="px-4 py-3">
                    <Selo linha={l} />
                  </td>
                  <td className="px-4 py-3 text-ink">{l.devolucao}</td>
                  <td className="px-4 py-3 text-right">
                    <VerContrato href={l.href} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="divide-y divide-line md:hidden">
            {linhas.map((l) => (
              <li key={l.chave} className="p-4" data-testid="caucao-bloco" data-chave={l.chaveStatus}>
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">{l.imovel}</span>
                    <span className="block text-xs text-muted">
                      Bloco {l.bloco} · {l.forma}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold text-ink">{formatBRL(l.valor)}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Selo linha={l} />
                  <span className="text-xs text-muted">Devolução: {l.devolucao}</span>
                </div>
                <div className="mt-1">
                  <VerContrato href={l.href} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <details className="mt-6 rounded-xl border border-line bg-white p-4 text-sm text-ink" data-testid="caucao-como-funciona">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Como funciona a caução</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-muted">
          <li>
            Até {Math.round(PERC_CAUCAO_BLOCO * 100)}% de cada bloco (blocos de até 90 dias), devolvível ao fim da estadia — até 3 vezes o valor mensal.
          </li>
          <li>Uma garantia por contrato: caução e seguro-fiança não se somam. Seguro-fiança via parceiro — em estruturação.</li>
          <li>Na devolução, descontam-se só débitos ou danos comprovados na conferência de saída; o restante volta ao morador.</li>
          <li>O dinheiro da caução nunca fica com a plataforma: o morador paga direto a você.</li>
        </ul>
      </details>
    </>
  );
}

function Selo({ linha }: { linha: LinhaCaucaoBloco }) {
  const cls = linha.pendente ? "bg-amber-100 text-amber-800" : "bg-sage-100 text-forest";
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${cls}`} data-testid="garantia-caucao-estado" data-chave={linha.chaveStatus}>
      {linha.status}
    </span>
  );
}

function VerContrato({ href }: { href: string }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-forest underline underline-offset-4" data-testid="caucao-ver-contrato">
      {ROTULO_VER_CONTRATO} <ChevronRight className="h-4 w-4" aria-hidden />
    </Link>
  );
}
