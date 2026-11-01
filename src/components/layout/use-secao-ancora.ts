"use client";

import { useEffect, useState } from "react";

/**
 * E340 (01/11): nas abas-âncora (painel do parceiro: #pedidos, #agenda, #ganhos numa página só), a aba acesa acompanha a
 * SEÇÃO visível — a 1ª que ainda ocupa a faixa de cima da tela; no fim da página, já passada ela, a última à vista. Antes de
 * as seções existirem (carregando) e em página que não rola, vale o #âncora da URL (ou a 1ª). Fora da `rota`: null.
 * `preferida`: a seção que a pessoa pediu (#âncora ao abrir ou aba clicada) vale enquanto estiver à vista — uma seção
 * curta no fim da página pode nunca chegar à linha (t776: abrir com #ganhos acendia Agenda).
 */
/** A faixa de cima da tela (px) que conta como "lendo agora": abaixo do cabeçalho fixo e do scroll-mt das seções. */
const LIMITE_TOPO = 120;

export function secaoVisivel(
  ids: readonly string[],
  hash: string,
  doc: Pick<Document, "getElementById"> = document,
  win: Pick<Window, "innerHeight" | "scrollY"> & { docAltura: number } = { innerHeight: window.innerHeight, scrollY: window.scrollY, docAltura: document.documentElement.scrollHeight },
  preferida: string | null = null,
): string | null {
  const daUrl = hash.replace(/^#/, "");
  const els = ids.map((id) => doc.getElementById(id)).filter((e): e is HTMLElement => !!e);
  if (!els.length) return ids.includes(daUrl) ? daUrl : (ids[0] ?? null);
  if (preferida) {
    const el = els.find((e) => e.id === preferida);
    const r = el?.getBoundingClientRect();
    if (r && r.top < win.innerHeight && r.bottom > 0) return preferida;
  }
  // Página que não rola (tudo cabe na tela): vale o #âncora clicado; sem ele, a 1ª seção.
  if (win.docAltura <= win.innerHeight + 2) return ids.includes(daUrl) ? daUrl : els[0].id;
  // A 1ª seção que ainda ocupa a faixa de cima da tela (abaixo do cabeçalho fixo). Seções curtas (lista vazia) não
  // "empurram" a vizinha de baixo para a aba acesa (t776 no lab: rolar até Pedidos acendia Agenda).
  const naFaixa = els.find((el) => el.getBoundingClientRect().bottom > LIMITE_TOPO);
  let atual = (naFaixa ?? els[els.length - 1]).id;
  // Fim da página e a pessoa já passou daquela seção: a última seção à vista (senão ela nunca acenderia).
  if (naFaixa && naFaixa.getBoundingClientRect().top < 0 && win.scrollY > 0 && win.innerHeight + win.scrollY >= win.docAltura - 2) {
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
    const daUrl = () => {
      const h = window.location.hash.replace(/^#/, "");
      return lista.includes(h) ? h : null;
    };
    // A seção pedida (#âncora ao abrir, hashchange ou aba clicada) vale até a pessoa rolar por conta própria.
    let preferida: string | null = daUrl();
    // O conteúdo chega depois da rolagem do navegador até o #âncora e empurra a seção para baixo: quando ela aparece,
    // rola até ela uma vez.
    let rolouAteAncora = false;
    let quadro = 0;
    const medir = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        if (!rolouAteAncora && preferida) {
          const el = document.getElementById(preferida);
          if (el) {
            rolouAteAncora = true;
            el.scrollIntoView({ block: "start" });
          }
        }
        setSecao(secaoVisivel(lista, window.location.hash, document, { innerHeight: window.innerHeight, scrollY: window.scrollY, docAltura: document.documentElement.scrollHeight }, preferida));
      });
    };
    const pediu = (id: string | null) => {
      preferida = id;
      rolouAteAncora = true;
      medir();
    };
    const soltar = () => {
      if (preferida) {
        preferida = null;
        medir();
      }
    };
    const aoClicar = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]");
      const href = a?.getAttribute("href") ?? "";
      const [caminho, id] = href.split("#");
      if (id && lista.includes(id) && (caminho === "" || caminho === rota)) {
        pediu(id);
        // Link para o mesmo #âncora que já está na URL: o navegador não rola — a seção é levada à vista aqui (t776 a 390).
        requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
      }
    };
    const aoMudarHash = () => pediu(daUrl());
    medir();
    const obs = new MutationObserver(medir);
    obs.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", medir, { passive: true });
    window.addEventListener("resize", medir);
    window.addEventListener("hashchange", aoMudarHash);
    document.addEventListener("click", aoClicar, true);
    // Rolagem da própria pessoa: a seção visível volta a mandar.
    for (const ev of ["wheel", "touchmove", "keydown"] as const) window.addEventListener(ev, soltar, { passive: true });
    return () => {
      cancelAnimationFrame(quadro);
      obs.disconnect();
      window.removeEventListener("scroll", medir);
      window.removeEventListener("resize", medir);
      window.removeEventListener("hashchange", aoMudarHash);
      document.removeEventListener("click", aoClicar, true);
      for (const ev of ["wheel", "touchmove", "keydown"] as const) window.removeEventListener(ev, soltar);
    };
  }, [rota, chave, pathname]);
  return pathname === rota ? secao : null;
}
