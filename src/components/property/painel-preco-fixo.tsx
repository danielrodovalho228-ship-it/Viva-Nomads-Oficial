"use client";

import { useEffect, useRef, useState } from "react";
import { TOPO_PAINEL_PRECO, topoDoPainel } from "@/lib/anuncio/painel-fixo";

/**
 * E528 (D14): o painel de preço do anúncio, fixo ao rolar e SEM rolagem interna. Cabe na janela → preso no topo (sticky);
 * mais alto que a janela → NÃO prende (rola com a página, inteiro): prender pela base cortava o cabeçalho e o total.
 */
export function PainelPrecoFixo({ children }: { children: React.ReactNode }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [topo, setTopo] = useState<number | null>(TOPO_PAINEL_PRECO);
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () => setTopo(topoDoPainel(el.offsetHeight, window.innerHeight));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    window.addEventListener("resize", medir);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", medir);
    };
  }, []);
  return (
    <div
      ref={caixa}
      id="cartao-preco"
      style={topo === null ? undefined : { top: topo }}
      data-topo={topo ?? "livre"}
      data-preso={topo === null ? "nao" : "sim"}
      className={`${topo === null ? "relative" : "sticky"} scroll-mt-36 rounded-xl border border-line bg-white p-4 xl:p-6`}
    >
      {children}
    </div>
  );
}
