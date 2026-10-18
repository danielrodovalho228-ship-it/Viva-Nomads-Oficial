"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { STATUS_VISITA_ROTULO, type StatusVisita } from "@/lib/visitas-video";

const TOM = {
  pedido: "bg-blue-50 text-blue-700",
  confirmado: "bg-emerald-100 text-emerald-700",
  feito: "bg-slate-100 text-slate-700",
  cancelado: "bg-slate-100 text-slate-500",
} as const;

const Ctx = createContext<{ status: StatusVisita; mudar: (s: StatusVisita) => void } | null>(null);

/** Guarda o status do pedido no navegador do dono: ao responder, a etiqueta muda na hora, mesmo que o recarregamento da página demore (t168). */
export function StatusVisitaProvider({ inicial, children }: { inicial: StatusVisita; children: ReactNode }) {
  const [alterado, setAlterado] = useState<{ de: StatusVisita; para: StatusVisita } | null>(null);
  // Se o servidor trouxer outro status (recarregou), vale o do servidor; a troca local só vale enquanto o status de origem é o mesmo.
  const status = alterado && alterado.de === inicial ? alterado.para : inicial;
  return <Ctx.Provider value={{ status, mudar: (para) => setAlterado({ de: inicial, para }) }}>{children}</Ctx.Provider>;
}

export function useStatusVisita(inicial: StatusVisita) {
  const c = useContext(Ctx);
  return c ?? { status: inicial, mudar: () => {} };
}

export function SeloStatusVisita({ inicial }: { inicial: StatusVisita }) {
  const { status } = useStatusVisita(inicial);
  return (
    <span data-testid="visita-status" className={`rounded-full px-3 py-1 text-xs font-semibold ${TOM[status]}`}>
      {STATUS_VISITA_ROTULO[status]}
    </span>
  );
}
