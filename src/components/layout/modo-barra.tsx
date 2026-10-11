"use client";

import { useEffect, useState } from "react";
import { Building2, Repeat, User } from "lucide-react";
import type { ViewMode } from "@/lib/store";
import { CORES_BARRA, avisoDeTroca, rotuloDoBotaoTrocar, textoDaBarra, outroModo } from "@/lib/modo-barra";
import { cn } from "@/lib/utils";

/**
 * Barra fixa no topo das telas logadas (site e app): mostra o modo atual e troca
 * ali mesmo. Ao mudar de modo (por aqui ou pela Conta) a cor e o ícone animam
 * (≤ 600 ms, desligado em prefers-reduced-motion) e aparece "Agora você está
 * como …", também lido por leitores de tela (aria-live).
 */
export function ModoBarra({
  mode,
  onSwitch,
  extra,
}: {
  mode: ViewMode;
  onSwitch: (m: ViewMode) => void;
  /** Slot à direita (ex.: toggle de demonstração do admin). */
  extra?: React.ReactNode;
}) {
  // Detecta a troca durante a renderização (sem efeito): o aviso não aparece na 1ª carga.
  const [anterior, setAnterior] = useState(mode);
  const [aviso, setAviso] = useState<string | null>(null);
  if (anterior !== mode) {
    setAnterior(mode);
    setAviso(avisoDeTroca(mode));
  }
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 2800);
    return () => clearTimeout(t);
  }, [aviso]);

  const Icone = mode === "owner" ? Building2 : User;
  return (
    <div
      data-testid="modo-barra"
      data-modo={mode}
      className={cn(
        "sticky top-0 z-20 flex items-center gap-3 border-b px-4 py-2 transition-colors duration-500 motion-reduce:transition-none sm:px-8 print:hidden",
        "[html[data-app]_&]:top-[calc(3rem+env(safe-area-inset-top,0px))]",
        CORES_BARRA[mode]
      )}
    >
      <span key={mode} className="modo-icone grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/70" aria-hidden>
        <Icone className="h-4 w-4" />
      </span>
      <p className="min-w-0 flex-1 truncate text-sm font-semibold">{textoDaBarra(mode)}</p>
      {extra}
      <button
        type="button"
        onClick={() => onSwitch(outroModo(mode))}
        aria-label={rotuloDoBotaoTrocar(mode)}
        className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 text-sm font-semibold shadow-sm ring-1 ring-black/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
      >
        <Repeat className="h-4 w-4" aria-hidden />
        Trocar
      </button>
      <p role="status" aria-live="polite" className={aviso ? "modo-aviso absolute inset-x-0 top-full z-10 mx-4 mt-1 rounded-lg bg-ink px-3 py-2 text-center text-sm text-white shadow-lg sm:mx-8" : "sr-only"}>
        {aviso}
      </p>
    </div>
  );
}
