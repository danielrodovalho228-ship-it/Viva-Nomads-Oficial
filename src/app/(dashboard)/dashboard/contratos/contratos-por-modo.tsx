"use client";

import type { ReactNode } from "react";
import { useViewMode } from "@/lib/roles";

/**
 * E167 / MORADOR-NAV: /dashboard/contratos mostra o lado do MODO em uso. No modo morador, só os contratos em que a
 * pessoa é a moradora (assinar, situação) — nunca "registre os recebimentos" do dono. No modo dono, os do dono (e,
 * se ele também for morador de outro imóvel, essa parte continua lá embaixo, separada). Quem não tem imóvel vê
 * sempre o lado morador.
 */
export function ContratosPorModo({ inquilino, dono, temInquilino }: { inquilino: ReactNode; dono: ReactNode | null; temInquilino: boolean }) {
  const { mode } = useViewMode();
  if (mode !== "owner" || !dono) return <div data-testid="contratos-modo-morador">{inquilino}</div>;
  return (
    <div data-testid="contratos-modo-dono">
      {dono}
      {temInquilino && <div className="mt-12">{inquilino}</div>}
    </div>
  );
}
