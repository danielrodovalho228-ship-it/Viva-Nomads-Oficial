"use client";

import { Button, ButtonLink } from "@/components/ui/button";

/** Falha ao abrir uma tela do painel: mensagem curta e "Tentar de novo", nunca uma página sem saída. */
export default function ErroDoPainel({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div role="alert" data-testid="painel-erro" className="rounded-xl border border-sage-200 bg-white p-4 sm:p-6 text-center">
      <h1 className="font-title text-lg font-semibold text-ink">Não conseguimos abrir esta tela</h1>
      <p className="mt-2 text-sm text-muted">Foi só um tropeço. Tente de novo; se continuar, volte ao início do painel.</p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={() => retry()}>
          Tentar de novo
        </Button>
        <ButtonLink href="/dashboard" variant="outline">
          Voltar ao painel
        </ButtonLink>
      </div>
    </div>
  );
}
