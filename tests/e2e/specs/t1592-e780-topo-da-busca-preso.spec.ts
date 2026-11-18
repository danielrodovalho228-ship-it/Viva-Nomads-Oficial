import { test, expect } from "@playwright/test";

/**
 * T1592 — GUARDA DO E780 (#3611, merge na main em 09/11): no celular, o topo da /buscar fica PRESO e inteiro — a faixa de
 * filtros (chips + Mais filtros · Ordenar · Mapa) é um contêiner `sticky` logo abaixo do cabeçalho fixo e a contagem rola por
 * baixo dela. No computador (lg+) a faixa segue no fluxo. Sem login nem banco (exemplos da casa em /buscar?exemplos=1).
 * 390 px: sticky; com a página rolada (900 e 2000 px) a faixa continua inteira na tela, colada no cabeçalho (mesma posição
 * nas duas rolagens, sem salto); a linha da contagem NÃO está dentro da faixa. 1280 px: static.
 */
test.describe("T1592 — E780: topo da /buscar preso no celular, no fluxo no computador", () => {
  test("390 px: faixa de filtros sticky, inteira e na mesma posição com a página rolada", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/buscar?exemplos=1", { waitUntil: "domcontentloaded" });
    const topo = page.getByTestId("busca-topo-fixo");
    await expect(topo).toBeVisible({ timeout: 30_000 });
    expect(await topo.evaluate((e) => getComputedStyle(e).position)).toBe("sticky");

    // A contagem rola por baixo: não está dentro do trecho preso.
    expect(await topo.getByTestId("linha-contagem").count()).toBe(0);

    const altura = await page.evaluate(() => document.documentElement.scrollHeight);
    test.skip(altura < 2600, `a página tem só ${altura}px: não dá para rolar 2000 px e provar o trecho preso`);

    const posicoes: number[] = [];
    for (const y of [900, 2000]) {
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.waitForTimeout(250);
      const caixa = await topo.boundingBox();
      expect(caixa, "a faixa tem caixa").not.toBeNull();
      // Inteira na tela: começa dentro da janela e termina antes do pé dela.
      expect(caixa!.y).toBeGreaterThanOrEqual(0);
      expect(caixa!.y + caixa!.height).toBeLessThanOrEqual(844);
      expect(caixa!.y, "a faixa fica logo abaixo do cabeçalho (não no topo absoluto)").toBeGreaterThan(40);
      posicoes.push(Math.round(caixa!.y));
    }
    expect(Math.abs(posicoes[0] - posicoes[1]), `a faixa não salta entre rolagens (${posicoes.join(" → ")})`).toBeLessThanOrEqual(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("1280 px: a faixa segue no fluxo (static)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/buscar?exemplos=1", { waitUntil: "domcontentloaded" });
    const topo = page.getByTestId("busca-topo-fixo");
    await expect(topo).toBeVisible({ timeout: 30_000 });
    expect(await topo.evaluate((e) => getComputedStyle(e).position)).toBe("static");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
