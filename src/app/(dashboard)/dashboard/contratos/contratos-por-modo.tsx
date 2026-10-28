"use client";

import type { ReactNode } from "react";
import { useViewMode } from "@/lib/roles";
import { AVISO_CONTRATOS_DE_MORADOR, ladoContratos } from "@/lib/contratos/area-dono";

/**
 * E167 / MORADOR-NAV: /dashboard/contratos mostra o lado do MODO em uso. No modo morador, só os contratos em que a
 * pessoa é a moradora (assinar, situação) — nunca "registre os recebimentos" do dono. Quem não tem imóvel vê sempre o
 * lado morador. E188: no modo dono, SÓ os contratos dos imóveis da pessoa; se ela também for moradora, um aviso curto
 * diz onde ficam esses contratos (a lista do morador não aparece aqui, para o vazio do dono não se contradizer).
 */
export function ContratosPorModo({ inquilino, dono, temInquilino }: { inquilino: ReactNode; dono: ReactNode | null; temInquilino: boolean }) {
  const { mode } = useViewMode();
  if (ladoContratos(mode, Boolean(dono)) === "morador") return <div data-testid="contratos-modo-morador">{inquilino}</div>;
  return (
    <div data-testid="contratos-modo-dono">
      {dono}
      {temInquilino && (
        <p className="mt-6 text-sm text-muted" data-testid="contratos-aviso-morador">
          {AVISO_CONTRATOS_DE_MORADOR}
        </p>
      )}
    </div>
  );
}
