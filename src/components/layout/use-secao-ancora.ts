"use client";

import { useEffect, useState } from "react";

/**
 * E340 (01/11): nas abas-âncora (painel do parceiro: #pedidos, #agenda, #ganhos numa página só), a aba acesa acompanha a
 * SEÇÃO visível — a última cujo topo passou da linha a 35% da tela; no fim da página, a última seção à vista. Antes de
 * as seções existirem (carregando), vale o #âncora da URL. Fora da `rota`: null.
 */
export function secaoVisivel(ids: readonly string[], hash: string, doc: Pick<Document, "getElementById"> = document, win: Pick<Window, "innerHeight" | "scrollY"> & { docAltura: number } = { innerHeight: window.innerHeight, scrollY: window.scrollY, docAltura: document.documentElement.scrollHeight }): string | null {
  const daUrl = hash.replace(/^#/, "");
  const els = ids.map((id) => doc.getElementById(id)).filter((e): e is HTMLElement => !!e);
  if (!els.length) return ids.includes(daUrl) ? daUrl : (ids[0] ?? null);
  // Página que não rola (tudo cabe na tela): vale o #âncora clicado; sem ele, a 1ª seção.
  if (win.docAltura <= win.innerHeight + 2) return ids.includes(daUrl) ? daUrl : els[0].id;
  const linha = win.innerHeight * 0.35;
  let atual = els[0].id;
  for (const el of els) if (el.getBoundingClientRect().top <= linha) atual = el.id;
  if (win.scrollY > 0 && win.innerHeight + win.scrollY >= win.docAltura - 2) {
    const aVista = els.filter((el) => el.getBoundingClientRect().top < win.innerHeight);
    if (aVista.length) atual = aVista[aVista.length - 1].id;
  }
  return atual;
}

export function useSecaoAncora(rota: string, ids: readonly string[], pathname: string): string | null {
  const [secao, setSecao] = useState<string | null>(null);
  const chave = ids.join(",");
  useEffect(() => {
    if (pathname !== rota || !chave) return;
    const lista = chave.split(",");
    let quadro = 0;
    const medir = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => setSecao(secaoVisivel(lista, window.location.hash)));
    };
    medir();
    // As seções chegam depois (dados do servidor) e mudam de altura: remede quando o conteúdo muda.
    const obs = new MutationObserver(medir);
    obs.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", medir, { passive: true });
    window.addEventListener("resize", medir);
    window.addEventListener("hashchange", medir);
    return () => {
      cancelAnimationFrame(quadro);
      obs.disconnect();
      window.removeEventListener("scroll", medir);
      window.removeEventListener("resize", medir);
      window.removeEventListener("hashchange", medir);
    };
  }, [rota, chave, pathname]);
  return pathname === rota ? secao : null;
}
