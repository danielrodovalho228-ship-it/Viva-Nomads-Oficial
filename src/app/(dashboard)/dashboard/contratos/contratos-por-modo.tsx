"use client";

import type { ReactNode } from "react";
import { useAuthStore } from "@/lib/store";
import { useViewMode } from "@/lib/roles";

/**
 * E167 / MORADOR-NAV: /dashboard/contratos mostra o lado do MODO em uso. No modo morador, só os contratos em que a
 * pessoa é a moradora (assinar, situação) — nunca "registre os recebimentos" do dono. No modo dono, SÓ os do dono
 * (E188: a página do papel só mostra dados do papel; antes, os contratos de morador vinham embaixo e o "Nenhum
 * contrato ainda" do dono ficava acima de uma lista com itens). Quem também é morador ganha só um atalho para o
 * modo morador. Quem não tem imóvel vê sempre o lado morador.
 */
export function ContratosPorModo({ inquilino, dono, temInquilino }: { inquilino: ReactNode; dono: ReactNode | null; temInquilino: boolean }) {
  const { mode } = useViewMode();
  const setActiveMode = useAuthStore((s) => s.setActiveMode);
  if (mode !== "owner" || !dono) return <div data-testid="contratos-modo-morador">{inquilino}</div>;
  return (
    <div data-testid="contratos-modo-dono">
      {dono}
      {temInquilino && (
        <p className="mt-8 text-sm text-muted" data-testid="contratos-atalho-morador">
          Os contratos das suas estadias como morador ficam no modo morador.{" "}
          <button type="button" onClick={() => setActiveMode("tenant")} className="min-h-11 font-medium text-forest underline">
            Ver no modo morador
          </button>
        </p>
      )}
    </div>
  );
}
