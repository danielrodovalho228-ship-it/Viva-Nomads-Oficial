"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Globe } from "lucide-react";
import { IDIOMAS, IDIOMA_PADRAO, ROTULO_EM_BREVE } from "@/config/idiomas";
import { cn } from "@/lib/utils";

/**
 * PUBLICO-A (desenho aprovado em 24/10): globo discreto PT/EN ao lado do "Entrar". Só o desenho: o português vem marcado
 * e o inglês aparece "em breve", sem poder ser escolhido — nada muda de idioma ainda.
 */
export function SeletorIdioma({ className, celular = false }: { className?: string; celular?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);
  const id = celular ? "seletor-idioma-celular" : "seletor-idioma";
  // No menu do celular, a escolha fica numa linha (nada abre por cima do "Entrar").
  if (celular)
    return (
      <div role="radiogroup" aria-label="Idioma" className={cn("flex min-h-11 items-center gap-3 text-sm", className)} data-testid={id}>
        <Globe className="h-4 w-4 text-ink/75" aria-hidden />
        {IDIOMAS.map((i) => (
          <span
            key={i.codigo}
            role="radio"
            aria-checked={i.codigo === IDIOMA_PADRAO.codigo}
            aria-disabled={!i.disponivel || undefined}
            className={cn("inline-flex items-center gap-1", i.disponivel ? "font-semibold text-forest" : "text-muted")}
            data-testid={`${id}-${i.codigo}`}
          >
            {i.codigo === IDIOMA_PADRAO.codigo && <Check className="h-4 w-4" aria-hidden />}
            {i.nome}
            {!i.disponivel && <span className="text-xs">({ROTULO_EM_BREVE})</span>}
          </span>
        ))}
      </div>
    );
  return (
    <div className={cn("relative", className)} ref={caixa}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={`Idioma: ${IDIOMA_PADRAO.nome}`}
        onClick={() => setAberto((v) => !v)}
        className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-ink/75 transition-colors hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
        data-testid={id}
      >
        <Globe className="h-4 w-4" aria-hidden />
        {IDIOMA_PADRAO.sigla}
      </button>
      {aberto && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-flutuante" data-testid={`${id}-menu`}>
          {IDIOMAS.map((i) => (
            <button
              key={i.codigo}
              type="button"
              role="menuitemradio"
              aria-checked={i.codigo === IDIOMA_PADRAO.codigo}
              aria-disabled={!i.disponivel || undefined}
              disabled={!i.disponivel}
              onClick={() => setAberto(false)}
              className={cn(
                "flex min-h-11 w-full items-center gap-2 px-4 text-left text-sm focus-visible:bg-surface-2 focus-visible:outline-none",
                i.disponivel ? "text-ink hover:bg-surface-2" : "cursor-not-allowed text-muted"
              )}
              data-testid={`${id}-${i.codigo}`}
            >
              <span className="w-4">{i.codigo === IDIOMA_PADRAO.codigo && <Check className="h-4 w-4 text-forest" aria-hidden />}</span>
              <span className="flex-1">{i.nome}</span>
              {!i.disponivel && <span className="text-xs">{ROTULO_EM_BREVE}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
