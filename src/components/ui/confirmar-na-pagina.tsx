"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Confirmação NA PÁGINA, em dois passos (adendo ao prompt 28): o 1º clique mostra o aviso com "Confirmar" e
 * "Cancelar"; o 2º executa. Substitui window.confirm/alert/prompt, que o navegador automatizado do QA cancela em
 * silêncio (o clique terminava sem nada na tela). Um teste de guarda impede que eles voltem a src/.
 */
export function ConfirmarNaPagina({
  aviso,
  confirmar = "Confirmar",
  onConfirmar,
  disabled,
  children,
  ariaLabel,
  variant = "outline",
  size,
  className,
  botaoClassName,
  testid,
}: {
  /** Texto do aviso mostrado no 1º clique. */
  aviso: string;
  /** Rótulo do botão que executa (2º clique). */
  confirmar?: string;
  onConfirmar: () => unknown;
  disabled?: boolean;
  /** Conteúdo do botão inicial (texto ou ícone). */
  children: React.ReactNode;
  ariaLabel?: string;
  variant?: "primary" | "outline" | "ghost" | "gold" | "secondary";
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Classes do botão inicial quando ele não usa o <Button> padrão (ex.: ícone). */
  botaoClassName?: string;
  testid?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  async function executar() {
    setOcupado(true);
    try {
      await onConfirmar();
    } finally {
      setOcupado(false);
      setAberto(false);
    }
  }
  return (
    <span className={cn("inline-flex flex-col items-stretch gap-2", className)}>
      {botaoClassName ? (
        <button type="button" aria-label={ariaLabel} disabled={disabled || ocupado} onClick={() => setAberto(true)} className={botaoClassName} data-testid={testid}>
          {children}
        </button>
      ) : (
        <Button type="button" variant={variant} size={size} aria-label={ariaLabel} disabled={disabled || ocupado} onClick={() => setAberto(true)} data-testid={testid}>
          {children}
        </Button>
      )}
      {aberto && (
        <span role="alertdialog" aria-label={aviso} className="block rounded-lg border border-amber-300 bg-amber-50 p-3 text-left text-sm text-amber-900" data-testid={testid ? `${testid}-confirmacao` : undefined}>
          <span className="block">{aviso}</span>
          <span className="mt-2 flex flex-wrap gap-2">
            <Button type="button" variant="primary" size="sm" disabled={ocupado} onClick={() => void executar()} data-testid={testid ? `${testid}-confirmar` : undefined}>
              {ocupado ? "Aguarde…" : confirmar}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={ocupado} onClick={() => setAberto(false)} data-testid={testid ? `${testid}-cancelar` : undefined}>
              Cancelar
            </Button>
          </span>
        </span>
      )}
    </span>
  );
}
