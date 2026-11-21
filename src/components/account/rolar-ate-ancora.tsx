"use client";

import { useEffect } from "react";
import { JANELA_DE_ASSENTO_MS, ancoraParaRolar } from "@/lib/conta/rolar-ate-ancora";

/**
 * E1007 — leva para a vista a seção pedida pela âncora do endereço (ex.: /dashboard/conta/dados#documento).
 * O navegador não faz isso sozinho aqui: a seção é desenhada depois do carregamento e os blocos de cima ainda mudam de
 * altura. A tela põe a seção no alto (respeitando a margem de rolagem dela) e a mantém lá enquanto a página assenta.
 * Nunca disputa a rolagem: ao primeiro gesto da pessoa (roda, toque, tecla, clique), ou passada a janela, solta.
 */
export function RolarAteAncora() {
  useEffect(() => {
    let soltar: (() => void) | null = null;
    const ir = () => {
      soltar?.();
      const id = ancoraParaRolar(window.location.hash);
      if (!id) return;
      let quadro = 0;
      const alinhar = () => {
        window.cancelAnimationFrame(quadro);
        quadro = window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
      };
      // A seção aparece e os blocos de cima mudam depois do carregamento: cada mudança da página realinha.
      const observador = new MutationObserver(alinhar);
      observador.observe(document.body, { childList: true, subtree: true });
      const GESTOS = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
      const encerrar = () => {
        window.cancelAnimationFrame(quadro);
        window.clearTimeout(prazo);
        observador.disconnect();
        GESTOS.forEach((g) => window.removeEventListener(g, encerrar, true));
        soltar = null;
      };
      const prazo = window.setTimeout(encerrar, JANELA_DE_ASSENTO_MS);
      GESTOS.forEach((g) => window.addEventListener(g, encerrar, { capture: true, passive: true }));
      soltar = encerrar;
      alinhar();
    };
    // Depois da pintura: os blocos já têm altura.
    const t = window.setTimeout(ir, 0);
    window.addEventListener("hashchange", ir);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("hashchange", ir);
      soltar?.();
    };
  }, []);
  return null;
}
