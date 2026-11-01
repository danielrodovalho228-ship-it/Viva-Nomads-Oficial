"use client";

import { Button, ButtonLink } from "@/components/ui/button";

/**
 * Falha ao abrir uma tela do painel: mensagem curta e "Tentar de novo", nunca uma página sem saída.
 * O Next 16 entrega `unstable_retry` (busca e renderiza de novo) e `reset` (só renderiza). Antes o componente lia uma
 * prop `retry`, que não existe: o botão chamava `undefined()` e quebrava sem fazer nada.
 */
export default function ErroDoPainel({ unstable_retry, reset }: { error: unknown; unstable_retry?: () => void; reset?: () => void }) {
  const tentarDeNovo = () => (unstable_retry ?? reset)?.();
  return (
    <div role="alert" data-testid="painel-erro" className="rounded-xl border border-sage-200 bg-white p-4 sm:p-6 text-center">
      <h1 className="font-title text-lg font-semibold text-ink">Não conseguimos abrir esta tela</h1>
      <p className="mt-2 text-sm text-muted">Foi só um tropeço. Tente de novo; se continuar, volte ao início do painel.</p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={tentarDeNovo} data-testid="painel-erro-tentar">
          Tentar de novo
        </Button>
        <ButtonLink href="/dashboard" variant="outline">
          Voltar ao painel
        </ButtonLink>
      </div>
    </div>
  );
}
