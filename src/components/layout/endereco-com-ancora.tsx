"use client";

import { useEffect } from "react";
import { contarAncoraAoRoteador } from "@/lib/navegacao/endereco-com-ancora";

/**
 * E1187 — o ouvinte da casca: quando o navegador salta para uma âncora da própria página, conta o endereço ao
 * roteador (a regra está em `contarAncoraAoRoteador`). Sem salto por âncora, não faz nada.
 */
export function EnderecoComAncora() {
  useEffect(() => {
    const contar = () => {
      contarAncoraAoRoteador(window);
    };
    window.addEventListener("hashchange", contar);
    // O salto pode ter saído antes de a página ligar: confere uma vez, já com o roteador a acompanhar o histórico.
    const depois = window.setTimeout(contar, 0);
    return () => {
      window.removeEventListener("hashchange", contar);
      window.clearTimeout(depois);
    };
  }, []);
  return null;
}
