import { test, expect, type Page } from "@playwright/test";
import { comPrecos } from "../fixtures/precos";

/*
  T847 — E504 (D-S1-16): nenhuma palavra colada na renderização. Duas medidas por página, em 1280 e 390:
  1) NA TELA: dois textos vizinhos de elementos diferentes, na mesma linha, sem espaço entre eles (letra encostada em
     letra, ≤ 1,5 px) — o "Vivaem Uberlândia" / "©2026Viva" do E405/E369;
  2) NO LEITOR DE TELA: a árvore de acessibilidade não lê minúscula+Maiúscula nem número+palavra grudados.
  O wordmark "VivaNomads" (logo oficial, escrito junto de propósito) e marcas de terceiros ficam de fora.
*/
const ROTAS = ["/", "/buscar", "/imoveis/ube-001", "/como-funciona", "/ajuda", ...comPrecos("/precos"), "/para-proprietarios", "/parceiros"];
const MARCAS = /^(VivaNomads|QuintoAndar|ZapSign|WhatsApp|LinkedIn|YouTube|TikTok|iPhone|GitHub|OpenStreetMap)/;

const coladosNaTela = (page: Page) =>
  page.evaluate(() => {
    const out = new Set<string>();
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        const e = n.parentElement;
        if (!e || !n.textContent?.trim()) return NodeFilter.FILTER_REJECT;
        if (e.closest('script,style,noscript,svg,[aria-hidden="true"],.sr-only,[data-logo]')) return NodeFilter.FILTER_REJECT;
        const r = e.getBoundingClientRect();
        return r.width && r.height ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const nos: Text[] = [];
    while (w.nextNode()) nos.push(w.currentNode as Text);
    for (let i = 1; i < nos.length; i++) {
      const a = nos[i - 1], b = nos[i];
      if (a.parentElement === b.parentElement) continue;
      const ta = a.textContent ?? "", tb = b.textContent ?? "";
      if (/\s$/.test(ta) || /^\s/.test(tb) || !/\p{L}$/u.test(ta) || !/^\p{L}/u.test(tb)) continue;
      const ra = document.createRange(); ra.setStart(a, ta.length - 1); ra.setEnd(a, ta.length);
      const rb = document.createRange(); rb.setStart(b, 0); rb.setEnd(b, 1);
      const A = ra.getBoundingClientRect(), B = rb.getBoundingClientRect();
      if (!A.width || !B.width || Math.abs(A.top - B.top) > 4) continue;
      const gap = B.left - A.right;
      if (gap <= 1.5 && gap >= -3) out.add(`${ta.trim().slice(-20)}⟂${tb.trim().slice(0, 20)}`);
    }
    return [...out];
  });

const coladosNoLeitor = async (page: Page) => {
  // Endereços (linhas "/url:") não são texto lido: no laboratório os ids dos imóveis são UUID ("…-4cbc-…").
  const arvore = (await page.locator("body").ariaSnapshot()).split("\n").filter((l) => !/^\s*- \/url:/.test(l)).join("\n");
  const out = new Set<string>();
  for (const m of arvore.matchAll(/[\p{L}\d]*(?:\p{Ll}\p{Lu}|\d[a-záéíóúâêôãõç]{3,}|[a-záéíóúâêôãõç]{3,}\d)[\p{L}\d]*/gu)) {
    const ctx = arvore.slice(Math.max(0, m.index - 12), m.index + m[0].length + 4);
    if (MARCAS.test(m[0]) || /^[0-9a-f]+$/.test(m[0]) || /%[0-9A-F]{2}|ube-\d/.test(ctx)) continue;
    out.add(m[0]);
  }
  return [...out];
};

for (const largura of [1280, 390] as const) {
  test.describe(`T847 — E504 (${largura}px)`, () => {
    test.use({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });

    for (const rota of ROTAS) {
      test(`${rota}: nenhuma palavra colada na tela nem no leitor de tela`, async ({ page }) => {
        await page.goto(rota, { waitUntil: "networkidle" });
        expect(await coladosNaTela(page), "na tela").toEqual([]);
        expect(await coladosNoLeitor(page), "no leitor de tela").toEqual([]);
      });
    }
  });
}
