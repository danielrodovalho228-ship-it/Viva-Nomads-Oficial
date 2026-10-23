"use client";

import { useRef, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { REGRAS_AVALIACOES, TITULO_COMO_FUNCIONAM } from "@/lib/avaliacoes-exibicao";

/**
 * Prompt 61-A, item 3 — link terciário no bloco de avaliações da página do imóvel. Abre uma folha com as regras;
 * Enter abre, Esc fecha e o foco volta ao link.
 */
export function ComoFuncionamAvaliacoes() {
  const [aberto, setAberto] = useState(false);
  const gatilho = useRef<HTMLButtonElement>(null);
  const fechar = () => {
    setAberto(false);
    requestAnimationFrame(() => gatilho.current?.focus());
  };
  return (
    <>
      <button
        ref={gatilho}
        type="button"
        onClick={() => setAberto(true)}
        className="text-sm text-forest underline underline-offset-2"
        data-testid="avaliacoes-como-funcionam"
      >
        {TITULO_COMO_FUNCIONAM}
      </button>
      <BottomSheet open={aberto} onClose={fechar} title={TITULO_COMO_FUNCIONAM} testId="avaliacoes-folha">
        <ul className="list-disc space-y-2 pl-4 text-sm text-ink">
          {REGRAS_AVALIACOES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </BottomSheet>
    </>
  );
}
