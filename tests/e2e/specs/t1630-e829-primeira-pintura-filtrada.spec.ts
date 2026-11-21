import { test, expect } from "@playwright/test";

/*
  T1630 — E829: o /buscar aberto por um atalho da home (?preco=2500, ?pet=1) já PINTA filtrado. Prova determinística:
  com o JavaScript DESLIGADO (só o HTML do servidor = a primeira pintura), a lista tem os mesmos anúncios que a página
  hidratada mostra no fim — e menos que a vitrine sem filtro. Antes, o HTML do servidor vinha com a lista completa.
*/
const ATALHOS = ["/buscar?exemplos=1&preco=2500", "/buscar?exemplos=1&pet=1"];

const idsDaLista = (page: import("@playwright/test").Page) =>
  page.locator('[data-testid="busca-lista"] [data-testid="cartao-imovel"] a[href^="/imoveis/"]').evaluateAll((els) =>
    [...new Set(els.map((e) => e.getAttribute("href") ?? ""))].sort(),
  );

test.describe("E829 — primeira pintura da busca respeita o filtro da URL", () => {
  test("sem JS (HTML do servidor) = resultado final filtrado, menor que a vitrine", async ({ browser }) => {
    const semJs = await browser.newContext({ javaScriptEnabled: false });
    const comJs = await browser.newContext();
    const p0 = await semJs.newPage();
    await p0.goto("/buscar?exemplos=1", { waitUntil: "load" });
    const vitrine = await idsDaLista(p0);
    expect(vitrine.length).toBeGreaterThan(1);
    for (const url of ATALHOS) {
      const a = await semJs.newPage();
      await a.goto(url, { waitUntil: "load" });
      const primeiraPintura = await idsDaLista(a);
      const b = await comJs.newPage();
      await b.goto(url, { waitUntil: "networkidle" });
      await expect(b.locator('[data-testid="busca-lista"] [data-testid="cartao-imovel"]').first()).toBeVisible();
      const final = await idsDaLista(b);
      expect(primeiraPintura, url).toEqual(final);
      expect(primeiraPintura.length, url).toBeLessThan(vitrine.length);
    }
    await semJs.close();
    await comJs.close();
  });
});
