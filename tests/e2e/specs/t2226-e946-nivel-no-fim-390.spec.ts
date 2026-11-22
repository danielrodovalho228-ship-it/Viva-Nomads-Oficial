import { test, expect } from "@playwright/test";

/*
  T2226 — E946 (ORDEM-DUET-469; uso real do Daniel, print de 15/11): em /buscar no celular (390 px) o chip "Nível" vai para
  o FIM da barra de filtros. Guarda a 390 px, visitante:
    - a barra desenha os chips na ordem Datas · Local · Tipo · Preço · Mais filtros · Ordenar · Mapa · Nível;
    - o Nível (quando existe — E452: só com nível para escolher) é o último chip, e está na última linha da barra;
    - nada desliza de lado (E780): nem a página, nem a barra.
  Trava determinística da ordem no código: src/components/busca/e946-ordem-filtros.test.ts.
*/
const ORDEM = ["pilula-datas", "pilula-local", "pilula-tipo", "pilula-preco", "pilula-mais", "pilula-ordenar", "pilula-mapa", "pilula-nivel"];

test.describe("T2226 — E946: o Nível no fim da barra de filtros a 390 px", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("390 px: ordem dos chips, Nível por último, sem deslize lateral", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    const barra = page.getByTestId("linha-pilulas");
    await expect(page.getByTestId("pilula-mapa")).toBeVisible({ timeout: 40_000 });
    // O Nível pode surgir depois de carregar as contagens (t1627): espera a barra assentar.
    await page.waitForLoadState("networkidle").catch(() => {});

    const chips = await barra.evaluate((el, ordem) => {
      const ids = new Set(ordem);
      return [...el.querySelectorAll("[data-testid]")]
        .filter((e) => ids.has(e.getAttribute("data-testid") ?? ""))
        .map((e) => {
          const r = (e as HTMLElement).getBoundingClientRect();
          return { id: e.getAttribute("data-testid")!, x: r.x, y: r.y, w: r.width, h: r.height };
        });
    }, ORDEM);
    const vistos = chips.map((c) => c.id);
    expect(vistos, "a barra desenha os chips nesta ordem").toEqual(ORDEM.filter((id) => vistos.includes(id)));
    for (const id of ORDEM.filter((x) => x !== "pilula-nivel")) expect(vistos, `${id} presente`).toContain(id);

    const nivel = chips.find((c) => c.id === "pilula-nivel");
    if (nivel) {
      expect(vistos[vistos.length - 1], "o Nível é o último chip").toBe("pilula-nivel");
      const mapa = chips.find((c) => c.id === "pilula-mapa")!;
      expect(nivel.y, "o Nível não fica acima do Mapa (nunca órfão no começo)").toBeGreaterThanOrEqual(mapa.y - 1);
      const ultimaLinha = Math.max(...chips.map((c) => c.y));
      expect(nivel.y, "o Nível está na última linha da barra").toBeGreaterThanOrEqual(ultimaLinha - 1);
    }
    for (const c of chips) {
      expect(c.x, `${c.id} começa dentro da tela`).toBeGreaterThanOrEqual(0);
      expect(c.x + c.w, `${c.id} termina dentro da tela`).toBeLessThanOrEqual(391);
    }
    const estouro = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(estouro, "a página não desliza de lado").toBeLessThanOrEqual(1);
    const barraEstouro = await barra.evaluate((el) => (el as HTMLElement).scrollWidth - (el as HTMLElement).clientWidth);
    expect(barraEstouro, "a barra não desliza de lado").toBeLessThanOrEqual(1);
  });
});
