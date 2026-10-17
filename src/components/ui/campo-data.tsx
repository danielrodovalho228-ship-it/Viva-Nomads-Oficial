"use client";

import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Campo de data nativo (calendário do celular) que não estoura o cartão no iPhone (Q3): o Safari dá ao
 * `input[type=date]` uma largura mínima própria; aqui ele ocupa a largura da coluna (regra global em
 * globals.css + `min-w-0 w-full block`). Vazio, o iOS mostra o campo em branco: o texto de exemplo
 * "dd/mm/aaaa" aparece por cima até a pessoa tocar.
 */
export function CampoData({
  value,
  className,
  exemplo = "dd/mm/aaaa",
  ...resto
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value"> & { value: string; exemplo?: string }) {
  const vazio = !value;
  return (
    <span className="relative block w-full min-w-0">
      <input
        {...resto}
        type="date"
        value={value}
        data-vazio={vazio ? "1" : undefined}
        className={cn("peer block w-full min-w-0 max-w-full", className)}
      />
      {vazio && (
        <span
          aria-hidden
          data-testid="campo-data-exemplo"
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-base text-muted peer-focus:hidden"
        >
          {exemplo}
        </span>
      )}
    </span>
  );
}
