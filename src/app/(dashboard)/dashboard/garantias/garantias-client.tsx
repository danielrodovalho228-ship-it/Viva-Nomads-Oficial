"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ShieldCheck, PiggyBank, RotateCcw, CircleDollarSign } from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { useDemoMode, DemoBadge } from "@/lib/demo/demo-mode";
import { DEMO_CONTRACTS } from "@/lib/demo/seed";
import type { ContratoView } from "@/lib/data/contratos-actions";
import { formatBRL } from "@/lib/utils";

interface LinhaCaucao {
  id: string;
  imovel: string;
  caucaoTotal: number;
  status: string; // pendente / retida / devolvida
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  retida: { label: "Retida (em custódia)", cls: "bg-sage-100 text-forest" },
  pendente: { label: "Pendente", cls: "bg-amber-100 text-amber-800" },
  devolvida: { label: "Devolvida", cls: "bg-sage-100 text-forest" },
};

function fromContratos(contratos: ContratoView[]): LinhaCaucao[] {
  return contratos.map((c) => {
    const caucaoTotal = c.blocos.reduce((s, b) => s + (b.caucao || 0), 0);
    // status agregado: se algum bloco pendente → pendente; senão retida.
    const algumPendente = c.blocos.some((b) => b.caucaoStatus === "pendente");
    return {
      id: c.id,
      imovel: c.propertyTitle,
      caucaoTotal,
      status: c.blocos.length === 0 ? "pendente" : algumPendente ? "pendente" : "retida",
    };
  });
}

/** Cauções de DEMONSTRAÇÃO (a caução Viva é 50% do bloco de 2 meses = 1 aluguel). */
function demoCaucoes(): LinhaCaucao[] {
  return DEMO_CONTRACTS.map((c, i) => ({
    id: `demo-cau-${i}`,
    imovel: c.imovel,
    caucaoTotal: c.valorMes, // 50% de um bloco de 2 meses
    status: i === 0 ? "retida" : i === 1 ? "pendente" : "retida",
  }));
}

export function GarantiasClient({ contratos }: { contratos: ContratoView[] }) {
  const { on: demoOn } = useDemoMode();
  const linhas = useMemo(
    () => (demoOn ? demoCaucoes() : fromContratos(contratos)),
    [demoOn, contratos]
  );

  return (
    <>
      <PageTitle
        title="Garantias"
        subtitle="Como funciona a garantia da locação e o status das cauções dos seus contratos."
        action={demoOn ? <DemoBadge /> : undefined}
      />

      {/* Explicação da garantia (fonte única, mesma linguagem do fechamento). */}
      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="Caução Viva (padrão)">
          <ul className="space-y-3 text-sm text-ink">
            <li className="flex items-start gap-2">
              <PiggyBank className="mt-0.5 h-4 w-4 shrink-0 text-forest" />
              <span>
                <strong>50% do bloco</strong> (contrato por blocos de 2 meses), <strong>devolvível</strong> ao
                fim da estadia — nos termos do contrato e da Lei 8.245/91 (art. 42).
              </span>
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-forest" />
              <span>
                <strong>Uma garantia por contrato</strong> — por lei, caução e seguro-fiança não se
                somam.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-forest" />
              <span>
                <strong>Devolução:</strong> ao encerrar, descontam-se apenas débitos/danos comprovados
                (vistoria de saída); o restante volta ao inquilino. A plataforma calcula e documenta.
              </span>
            </li>
          </ul>
          <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
            O dinheiro da caução <strong>nunca fica com a plataforma</strong> — vai para conta
            vinculada entre as partes.
          </p>
        </Panel>

        <Panel title="Seguro-fiança (alternativa)">
          <p className="text-sm text-ink">
            Para quem prefere não imobilizar caixa: uma mensalidade diluída cobre o aluguel, sem
            depósito. Contratado com parceiro e sujeito a análise.
          </p>
          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
            Seguro-fiança via parceiro — em estruturação
          </span>
          <p className="mt-4 text-xs text-muted">
            A Viva Nomads conecta, verifica e documenta — não é fiadora nem seguradora.
          </p>
        </Panel>
      </div>

      {/* Status das cauções dos contratos (espelha Contratos & blocos). */}
      <div className="mt-8">
        <h2 className="font-title text-lg font-bold text-ink">Cauções dos seus contratos</h2>
        <p className="text-sm text-muted">Resumo por contrato — o detalhe por bloco fica em Contratos & blocos.</p>

        {linhas.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={ShieldCheck}
              title="Nenhuma caução ainda"
              text="Quando você fechar uma locação, a caução do contrato aparece aqui com o status."
              action={
                <Link href="/dashboard/contratos" className="text-sm font-medium text-forest underline">
                  Ver Contratos & blocos
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {linhas.map((l) => {
              const meta = STATUS_META[l.status] ?? STATUS_META.pendente;
              return (
                <Panel key={l.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-title font-bold text-ink">{l.imovel}</p>
                    <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted">
                      <CircleDollarSign className="h-3.5 w-3.5" /> Caução {formatBRL(l.caucaoTotal)}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${meta.cls}`}>
                    {meta.label}
                  </span>
                </Panel>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
