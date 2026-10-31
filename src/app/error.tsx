"use client";

import { Button, ButtonLink } from "@/components/ui/button";

/**
 * Erro fora do alcance do error.tsx do painel. O error.tsx de um segmento não cobre o layout do mesmo segmento: uma
 * falha no layout do painel ((dashboard)/layout.tsx, que lê o modo e os contadores para todo morador e proprietário)
 * caía na página padrão do Next, em inglês ("Application error: a server-side exception has occurred"). Aqui sai em
 * português, com "Tentar de novo" (unstable_retry do Next 16; reset de reserva) e as saídas certas.
 */
export default function ErroDoSite({ unstable_retry, reset }: { error: unknown; unstable_retry?: () => void; reset?: () => void }) {
  const tentarDeNovo = () => (unstable_retry ?? reset)?.();
  return (
    <main role="alert" data-testid="site-erro" className="container-page flex min-h-[60vh] flex-col items-center justify-center py-12 text-center">
      <h1 className="font-title text-2xl font-semibold text-ink">Não conseguimos abrir esta página</h1>
      <p className="mt-2 max-w-md text-muted">Foi só um tropeço do nosso lado. Tente de novo; se continuar, volte ao início ou fale com a Viva.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={tentarDeNovo} data-testid="site-erro-tentar">
          Tentar de novo
        </Button>
        <ButtonLink href="/" variant="outline">
          Ir para o início
        </ButtonLink>
        <ButtonLink href="/ajuda" variant="outline">
          Falar com a Viva
        </ButtonLink>
      </div>
    </main>
  );
}
