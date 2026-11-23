"use client";

import { useEffect, useRef } from "react";

/**
 * E1104: a âncora do bloco da avaliação na página do nível do imóvel. A página é longa e o que fica por cima do bloco
 * ainda cresce depois de aberta (fotos, sugestões): a rolagem do navegador até a âncora pousava num ponto que deixava de
 * ser o do bloco, e quem vinha do cartão "Avaliação do imóvel" não via o pedido. Aqui, quem chega com esta âncora no
 * endereço é levado ao bloco e mantido nele enquanto a página assenta (alguns segundos), até a pessoa mexer na tela.
 * Sem a âncora no endereço, não faz nada.
 */
export function AncoraDaAvaliacao({ id, children }: { id: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.location.hash !== `#${id}`) return;
    let ativo = true;
    const parar = () => {
      ativo = false;
    };
    const alinhar = () => {
      if (ativo) el.scrollIntoView({ block: "start" });
    };
    alinhar();
    const observador = new ResizeObserver(alinhar);
    observador.observe(document.body);
    const fim = window.setTimeout(parar, 5000);
    const gestos = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    for (const g of gestos) window.addEventListener(g, parar, { once: true, passive: true });
    return () => {
      ativo = false;
      observador.disconnect();
      window.clearTimeout(fim);
      for (const g of gestos) window.removeEventListener(g, parar);
    };
  }, [id]);

  return (
    <div ref={ref} id={id} className="scroll-mt-24">
      {children}
    </div>
  );
}
