"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * E248 (varredura do dono, 29/10): uma fileira que rola na horizontal (abas, filtros) e MOSTRA que há mais.
 * Quando sobra item fora da tela, aparece na borda um botão "›" (e "‹" do outro lado depois de rolar), sólido — sem
 * degradê (padrão visual do produto) — que rola a fileira. Sem sobra (computador), nada aparece e nada muda.
 * `classeExterna` posiciona o conjunto (margens); `className` e o resto vão para a fileira em si.
 */
export function FileiraRolavel({
  as: Tag = "div",
  classeExterna,
  className,
  children,
  ...resto
}: { as?: "div" | "nav"; classeExterna?: string } & React.HTMLAttributes<HTMLElement>) {
  const ref = useRef<HTMLElement>(null);
  const [sobra, setSobra] = useState({ esq: false, dir: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setSobra({ esq: el.scrollLeft > 1, dir: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 });
    medir();
    el.addEventListener("scroll", medir, { passive: true });
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(medir);
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", medir);
      ro?.disconnect();
    };
  }, []);

  const rolar = (lado: 1 | -1) => ref.current?.scrollBy({ left: lado * Math.round(ref.current.clientWidth * 0.6), behavior: "smooth" });
  const seta = "absolute top-0 grid h-11 w-11 place-items-center border-line bg-surface-2 text-ink";

  return (
    <div className={cn("relative", classeExterna)} data-fileira-rolavel data-sobra-dir={sobra.dir ? "1" : undefined}>
      <Tag ref={ref as React.Ref<HTMLDivElement>} className={cn("overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)} {...resto}>
        {children}
      </Tag>
      {sobra.esq && (
        <button type="button" aria-label="Ver itens anteriores" onClick={() => rolar(-1)} className={cn(seta, "left-0 border-r")} data-testid="fileira-seta-esq">
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
      )}
      {sobra.dir && (
        <button type="button" aria-label="Ver mais itens" onClick={() => rolar(1)} className={cn(seta, "right-0 border-l")} data-testid="fileira-seta-dir">
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
