"use client";

import { Button, ButtonLink } from "@/components/ui/button";

/**
 * Falha numa página do site (busca, anúncio, parceiros, pedidos…): a mensagem fica DENTRO da casca do site, com o
 * menu, o rodapé e a barra de abas, em vez de subir até o error.tsx da raiz, que troca a página inteira e deixa a
 * pessoa sem navegação. Este error.tsx não cobre o layout do próprio (public) (docs do Next 16): uma falha no menu ou
 * no rodapé continua no error.tsx da raiz. Está dentro do <main id="conteudo"> do layout, por isso é um <div>.
 * O Next 16 entrega `unstable_retry` (busca e renderiza de novo) e `reset` (só renderiza) — o primeiro que vier.
 */
export default function ErroDoSitePublico({ unstable_retry, reset }: { error: unknown; unstable_retry?: () => void; reset?: () => void }) {
  const tentarDeNovo = () => (unstable_retry ?? reset)?.();
  return (
    <div role="alert" data-testid="publico-erro" className="container-page flex min-h-[50vh] flex-col items-center justify-center py-12 text-center">
      <h1 className="font-title text-2xl font-semibold text-ink">Não conseguimos abrir esta página</h1>
      <p className="mt-2 max-w-md text-muted">Foi só um tropeço do nosso lado. Tente de novo; se continuar, volte ao início ou fale com a Viva.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={tentarDeNovo} data-testid="publico-erro-tentar">
          Tentar de novo
        </Button>
        <ButtonLink href="/" variant="outline">
          Ir para o início
        </ButtonLink>
        <ButtonLink href="/ajuda" variant="outline">
          Falar com a Viva
        </ButtonLink>
      </div>
    </div>
  );
}
