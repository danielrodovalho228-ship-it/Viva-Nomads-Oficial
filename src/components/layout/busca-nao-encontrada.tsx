"use client";

import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { CHAVE_BUSCA_404, hrefBuscarImoveis, termoDaUrl404, textoParaRepor, urlDa404ComTermo } from "@/lib/navegacao/busca-404";

function lerGuardado(): string | null {
  try {
    return sessionStorage.getItem(CHAVE_BUSCA_404);
  } catch {
    return null;
  }
}

/** Mantém o termo na URL desta 404 (sem nova entrada no histórico): o Voltar regressa a uma URL que já o traz. */
function guardarNaUrl(termo: string) {
  try {
    const { pathname, search, hash } = window.location;
    const nova = urlDa404ComTermo(pathname, search, hash, termo);
    if (nova !== `${pathname}${search}${hash}`) window.history.replaceState(window.history.state, "", nova);
  } catch {}
}

/**
 * E916/E1019: a busca da 404 (cidade ou bairro → /buscar?local=) e o "Buscar imóveis". Continua um formulário HTML
 * (funciona sem JavaScript). O texto digitado não se perde:
 *  - se o campo é trocado por um nó novo depois da hidratação (o SCRIPT_GUARDA_BUSCA_404 da página guarda; aqui repõe);
 *  - se a pessoa segue por "Buscar imóveis" e volta (prova de 19/11): o link leva o termo e a URL da 404 guarda-o
 *    (?local=…), por isso o Voltar repõe o campo a partir da URL, de forma determinística.
 */
export function BuscaNaoEncontrada() {
  const campo = useRef<HTMLInputElement>(null);
  const [termo, setTermo] = useState("");

  useEffect(() => {
    const el = campo.current;
    if (!el) return;
    if (!el.value.trim()) {
      const daUrl = termoDaUrl404(window.location.search);
      const repor = daUrl.trim() ? daUrl : textoParaRepor(el.value, lerGuardado(), Date.now());
      if (repor) el.value = repor;
    }
    setTermo(el.value);
    if (el.value.trim()) guardarNaUrl(el.value);
  }, []);

  return (
    <>
      <form
        action="/buscar"
        method="get"
        role="search"
        className="mt-8 flex w-full max-w-md gap-2"
        data-testid="nao-encontrada-busca"
        onSubmit={() => {
          const el = campo.current;
          if (!el) return;
          const repor = textoParaRepor(el.value, lerGuardado(), Date.now());
          if (repor !== null) el.value = repor;
          try {
            sessionStorage.removeItem(CHAVE_BUSCA_404);
          } catch {}
        }}
      >
        <label htmlFor="nao-encontrada-local" className="sr-only">
          Cidade ou bairro
        </label>
        <input
          ref={campo}
          id="nao-encontrada-local"
          name="local"
          type="search"
          placeholder="Cidade ou bairro"
          onInput={(e) => {
            setTermo(e.currentTarget.value);
            guardarNaUrl(e.currentTarget.value);
          }}
          className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-white px-4 text-base text-ink outline-none focus:border-forest"
        />
        <Button type="submit" className="shrink-0">
          Buscar
        </Button>
      </form>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <ButtonLink href={hrefBuscarImoveis(termo)} variant="primary" data-testid="nao-encontrada-buscar-imoveis">
          Buscar imóveis
        </ButtonLink>
        <ButtonLink href="/" variant="outline">
          Ir para o início
        </ButtonLink>
      </div>
    </>
  );
}
