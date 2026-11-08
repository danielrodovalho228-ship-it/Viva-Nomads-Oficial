import { test, expect, type Page } from "@playwright/test";
import { PAGINAS_PUBLICAS } from "../fixtures/varredura-pagina";

/*
  T1480 — DOIS TESTES PROPOSTOS PELA QA (rodada 06:10, 08/11, "Propostas de teste determinístico à Pista C"):
    T-fixos: nas páginas públicas, a 390 e 1280 px, com a página rolada até o fim, nenhum texto do <main> e do <footer> fica com o
       centro sob um elemento FIXO de baixo (elementFromPoint), exceto o próprio texto do elemento fixo.
    T-dinâmicas: as páginas públicas que vêm do sitemap (guia, cidade, polo, imóvel, parceiro...) respondem abaixo de 400, têm
       exatamente 1 <h1> e nenhuma imagem carregada com largura natural 0; e /imoveis-perto-de/{inexistente} responde 404.
  Visitante. Usa a mesma lista de páginas públicas da varredura (t274); rota que o laboratório não tem (sem item no sitemap) é pulada.
*/
test.use({ storageState: { cookies: [], origins: [] } });

async function rolarAteOFim(page: Page) {
  await page.evaluate(async () => {
    let y = 0;
    while (y < document.documentElement.scrollHeight) {
      window.scrollTo(0, y);
      y += Math.round(innerHeight * 0.8);
      await new Promise((r) => setTimeout(r, 120));
    }
    // A página cresce enquanto rola (imagens e listas que chegam): insiste até encostar de verdade no fim.
    for (let i = 0; i < 25; i++) {
      window.scrollTo(0, document.documentElement.scrollHeight);
      await new Promise((r) => setTimeout(r, 300));
      if (scrollY + innerHeight >= document.documentElement.scrollHeight - 2) break;
    }
  });
  await page.waitForTimeout(400);
}

test.describe("T1480 — fixos × conteúdo e dinâmicas públicas (visitante)", () => {
  const DINAMICAS = /\((1º|1ª|2º|3º) /;
  for (const w of [390, 1280] as const) {
    test(`a ${w} px: nenhum texto fica sob elemento fixo; dinâmicas com 1 h1 e sem imagem vazia`, async ({ page, request }) => {
      test.setTimeout(480_000);
      await page.setViewportSize({ width: w, height: 844 });
      const problemas: string[] = [];
      let visitadas = 0;
      for (const p of PAGINAS_PUBLICAS) {
        const rota = typeof p.rota === "string" ? p.rota : await p.rota(request);
        if (!rota) continue;
        const r = await page.goto(rota, { waitUntil: "domcontentloaded" });
        if ((r?.status() ?? 0) >= 400) {
          problemas.push(`${p.nome} ${rota}: HTTP ${r?.status()}`);
          continue;
        }
        visitadas++;
        await rolarAteOFim(page);
        const m = await page.evaluate(() => {
          const sob: string[] = [];
          const raiz = document.querySelectorAll("main, footer");
          for (const el of raiz) {
            const it = document.createNodeIterator(el, NodeFilter.SHOW_TEXT);
            let n: Node | null;
            while ((n = it.nextNode())) {
              const t = (n.textContent ?? "").trim();
              if (t.length < 3 || !n.parentElement) continue;
              const range = document.createRange();
              range.selectNodeContents(n);
              const b = range.getBoundingClientRect();
              if (b.width < 2 || b.height < 2 || b.bottom < 0 || b.top > innerHeight) continue;
              const cx = b.left + b.width / 2;
              const cy = b.top + b.height / 2;
              if (cx < 0 || cx > innerWidth || cy < 0 || cy > innerHeight) continue;
              const topo = document.elementFromPoint(cx, cy);
              if (!topo || topo === n.parentElement || topo.contains(n.parentElement) || n.parentElement.contains(topo)) continue;
              let f: Element | null = topo;
              let fixo = false;
              let fixoEl: Element | null = null;
              let fr: DOMRect | null = null;
              while (f && f !== document.body) {
                // Só os fixos de BAIXO (barra de baixo, botão redondo, faixa de cookies): o cabeçalho fixo do topo cobrindo o que rola por baixo dele é o comportamento normal.
                if (getComputedStyle(f).position === "fixed" && f.getBoundingClientRect().top > innerHeight * 0.4) {
                  fixo = true;
                  fixoEl = f;
                  fr = f.getBoundingClientRect();
                  break;
                }
                f = f.parentElement;
              }
              if (fixo) sob.push(`"${t.slice(0, 40)}" y=${Math.round(cy)} sob ${(fixoEl?.getAttribute("data-testid") ?? fixoEl?.className?.toString().slice(0, 40) ?? "?")} [${Math.round(fr?.top ?? 0)}-${Math.round(fr?.bottom ?? 0)}] op=${fixoEl ? getComputedStyle(fixoEl).opacity : "?"} rolagem=${Math.round(scrollY)}/${document.documentElement.scrollHeight - innerHeight}`);
            }
          }
          const h1 = document.querySelectorAll("h1").length;
          // Tiles do mapa (CARTO) ficam de fora: dependem da rede, e uma queda deles não é defeito do site (QA, rodada 07:05).
          const vazias = Array.from(document.images).filter((i) => i.complete && i.naturalWidth === 0 && i.currentSrc && !i.closest(".leaflet-container")).length;
          return { sob: sob.slice(0, 3), h1, vazias };
        });
        if (m.sob.length) problemas.push(`${p.nome} ${rota}: texto sob elemento fixo (${m.sob.join("; ")})`);
        if (DINAMICAS.test(p.nome)) {
          if (m.h1 !== 1) problemas.push(`${p.nome} ${rota}: ${m.h1} <h1>`);
          if (m.vazias > 0) problemas.push(`${p.nome} ${rota}: ${m.vazias} imagem(ns) com largura natural 0`);
        }
      }
      expect(visitadas, "o laboratório devolve páginas públicas").toBeGreaterThan(10);
      expect(problemas, problemas.join("\n")).toEqual([]);
    });
  }

  test("/imoveis-perto-de/{inexistente} responde 404", async ({ page }) => {
    const r = await page.goto("/imoveis-perto-de/destino-que-nao-existe-t1480", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBe(404);
  });
});
