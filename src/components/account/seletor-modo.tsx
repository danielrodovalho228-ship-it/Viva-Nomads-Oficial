"use client";

import { Building2, User } from "lucide-react";
import type { ViewMode } from "@/lib/store";
import { MODE_META } from "@/lib/roles";
import { cn } from "@/lib/utils";

const ICONE: Record<ViewMode, React.ComponentType<{ className?: string }>> = {
  owner: Building2,
  tenant: User,
};

/**
 * Seletor de dois lados (Proprietário | Inquilino). Um indicador desliza até o
 * lado ativo; sem movimento para quem pediu menos animação (motion-reduce).
 */
export function SeletorModo({
  mode,
  onSwitch,
  className,
}: {
  mode: ViewMode;
  onSwitch: (m: ViewMode) => void;
  className?: string;
}) {
  const modes: ViewMode[] = ["owner", "tenant"];
  return (
    <div
      role="radiogroup"
      aria-label="Usar a conta como Proprietário ou Inquilino"
      className={cn("relative grid w-full grid-cols-2 rounded-full border border-sage-200 bg-surface-2 p-1", className)}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-300 ease-out motion-reduce:transition-none"
        style={{ transform: mode === "tenant" ? "translateX(100%)" : "translateX(0)" }}
      />
      {modes.map((m) => {
        const Icon = ICONE[m];
        const ativo = mode === m;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => !ativo && onSwitch(m)}
            className={cn(
              "relative z-10 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full py-1.5 text-sm font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest",
              ativo ? MODE_META[m].accentText : "text-muted hover:text-ink"
            )}
          >
            <Icon className="h-4 w-4" />
            {MODE_META[m].label}
          </button>
        );
      })}
    </div>
  );
}
