"use client";

import { useEffect } from "react";
import { deveIrParaAvisos, hashAvisosNormalizado } from "@/lib/notifications/ir-para-avisos";

/**
 * E489 — "Ver todas" do sino chega em /dashboard/notificacoes#avisos. No computador quem rola é o <main> do painel, e a
 * âncora sozinha deixava a pessoa nas preferências. Aqui a seção da lista vai para a vista (dentro do container que
 * rola) e o foco vai para o título — também quando o sino é usado com a página já aberta (hashchange).
 */
export function IrParaAvisos({ alvo, titulo }: { alvo: string; titulo: string }) {
  useEffect(() => {
    const ir = () => {
      if (!deveIrParaAvisos(window.location.hash)) return;
      // E496: a âncora chegou repetida (#avisos#avisos) — o endereço volta à forma única, mantendo o estado do roteador.
      const certo = hashAvisosNormalizado(window.location.hash);
      if (certo) window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}${certo}`);
      const secao = document.getElementById(alvo);
      if (!secao) return;
      secao.scrollIntoView({ block: "start" });
      document.getElementById(titulo)?.focus({ preventScroll: true });
    };
    // Depois da pintura: a lista e o painel já têm altura.
    const t = window.setTimeout(ir, 0);
    window.addEventListener("hashchange", ir);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("hashchange", ir);
    };
  }, [alvo, titulo]);
  return null;
}
