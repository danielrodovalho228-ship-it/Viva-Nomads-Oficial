"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { CHAVE_BUSCA_404, textoParaRepor } from "@/lib/navegacao/busca-404";

function lerGuardado(): string | null {
  try {
    return sessionStorage.getItem(CHAVE_BUSCA_404);
  } catch {
    return null;
  }
}

/**
 * E916/E1019: a busca da 404 (cidade ou bairro → /buscar?local=). Continua um formulário HTML (funciona sem JavaScript);
 * o JavaScript só impede que o texto digitado se perca quando o campo é trocado por um nó novo depois da hidratação.
 * Quem guarda é o SCRIPT_GUARDA_BUSCA_404 da página (escuta no document); aqui só se repõe, ao montar e no envio.
 */
export function BuscaNaoEncontrada() {
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = campo.current;
    if (!el) return;
    const repor = textoParaRepor(el.value, lerGuardado(), Date.now());
    if (repor !== null) el.value = repor;
  }, []);

  return (
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
        className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-white px-4 text-base text-ink outline-none focus:border-forest"
      />
      <Button type="submit" className="shrink-0">
        Buscar
      </Button>
    </form>
  );
}
