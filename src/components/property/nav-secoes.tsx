"use client";

import { useEffect, useRef, useState } from "react";
import type { SecaoImovel } from "@/lib/imovel-pagina";
import { cn } from "@/lib/utils";

/**
 * Abas âncora da página do imóvel (ordem d943f893): presas logo abaixo do cabeçalho
 * ao rolar, a aba da seção visível fica marcada e o toque leva até a seção. No
 * celular as abas rolam na horizontal e a ativa se mantém à vista.
 */
export function NavSecoes({ secoes }: { secoes: SecaoImovel[] }) {
  const [ativa, setAtiva] = useState(secoes[0]?.id);
  const lista = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const els = secoes.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => !!e);
    if (els.length === 0) return;
    // A seção "ativa" é a última cujo topo já passou da faixa logo abaixo das abas.
    const atualizar = () => {
      const limite = 150;
      let atual = els[0].id;
      for (const el of els) if (el.getBoundingClientRect().top - limite <= 0) atual = el.id;
      // Última seção curta: no fim da página ela nunca chega ao topo — marca quando já está à vista.
      const ultima = els[els.length - 1];
      const r = ultima.getBoundingClientRect();
      const noFim = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (noFim || (r.top < window.innerHeight * 0.5 && r.bottom > 0)) atual = ultima.id;
      setAtiva(atual);
    };
    atualizar();
    window.addEventListener("scroll", atualizar, { passive: true });
    return () => window.removeEventListener("scroll", atualizar);
  }, [secoes]);

  // Mantém a aba ativa visível na faixa rolável do celular.
  useEffect(() => {
    const el = lista.current?.querySelector<HTMLElement>(`[data-secao="${ativa}"]`);
    const caixa = lista.current;
    if (!el || !caixa) return;
    const esq = el.offsetLeft - 16;
    if (esq < caixa.scrollLeft || el.offsetLeft + el.offsetWidth > caixa.scrollLeft + caixa.clientWidth)
      caixa.scrollTo({ left: Math.max(0, esq), behavior: "smooth" });
  }, [ativa]);

  return (
    <nav
      aria-label="Seções do anúncio"
      data-testid="nav-secoes"
      className="sticky top-18 z-20 -mx-5 mt-6 border-b border-line bg-white/95 backdrop-blur sm:-mx-8 lg:mx-0 print:hidden"
    >
      <div ref={lista} className="flex gap-1 overflow-x-auto px-5 [scrollbar-width:none] sm:px-8 lg:px-0 [&::-webkit-scrollbar]:hidden">
        {secoes.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            data-secao={s.id}
            aria-current={ativa === s.id ? "true" : undefined}
            onClick={() => setAtiva(s.id)}
            className={cn(
              "shrink-0 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold transition-colors",
              ativa === s.id ? "border-forest text-forest" : "border-transparent text-muted hover:text-ink"
            )}
          >
            {s.rotulo}
          </a>
        ))}
      </div>
    </nav>
  );
}
