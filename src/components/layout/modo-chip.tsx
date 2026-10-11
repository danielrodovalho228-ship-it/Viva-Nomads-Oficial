"use client";

import { useEffect, useState } from "react";
import { Building2, User } from "lucide-react";
import type { ViewMode } from "@/lib/store";
import { Avatar } from "@/components/ui/avatar";
import { CORES_CHIP, avisoDeTroca, rotuloDoChip, rotuloDoBotaoTrocar, outroModo } from "@/lib/modo-barra";
import { cn } from "@/lib/utils";

/**
 * Chip do cabeçalho (site e app): foto pequena (ou iniciais) + modo atual.
 * Tocar troca Proprietário ⇄ Inquilino. Ao trocar, o ícone faz a "virada de chave"
 * (≤ 600 ms, só CSS, desligada em prefers-reduced-motion) e o leitor de tela
 * ouve "Agora você está como …" (aria-live; não fala na 1ª carga).
 */
export function ModoChip({
  mode,
  onSwitch,
  nome,
  photoUrl,
}: {
  mode: ViewMode;
  onSwitch: (m: ViewMode) => void;
  nome: string;
  photoUrl?: string;
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
    <>
      <button
        type="button"
        data-testid="modo-chip"
        data-modo={mode}
        onClick={() => onSwitch(outroModo(mode))}
        aria-label={`${rotuloDoChip(mode)}. ${rotuloDoBotaoTrocar(mode)}`}
        className={cn(
          "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-xs font-semibold transition-colors duration-500 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest print:hidden",
          CORES_CHIP[mode]
        )}
      >
        <Avatar name={nome} size={28} photoUrl={photoUrl} />
        <span key={mode} className="modo-chave grid h-4 w-4 place-items-center" aria-hidden>
          <Icone className="h-4 w-4" />
        </span>
        <span>{rotuloDoChip(mode)}</span>
      </button>
      <p role="status" aria-live="polite" className="sr-only">
        {aviso}
      </p>
    </>
  );
}
