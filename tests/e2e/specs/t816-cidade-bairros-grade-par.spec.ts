import { test, expect } from "@playwright/test";

/*
  T816 — varredura 02/11 (Pista A): na página da cidade, os bairros em grade par. A 768 px (2 colunas), com número
  ímpar de bairros, o último ocupa a linha inteira; a 1280 (3 colunas, varredura 23), o que sobra preenche a linha; a 390
  (1 coluna), nada muda. Sem rolagem lateral.
*/
for (const largura of [390, 768, 1280] as const) {
  test(`T816 — bairros da cidade em grade par (${largura} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const r = await page.goto("/cidades/uberlandia", { waitUntil: "domcontentloaded" });
    test.skip(!r || r.status() === 404, "Sem a página de Uberlândia neste ambiente.");
    const lista = page.getByTestId("bairros-grade").locator("ul").first();
    test.skip((await lista.count()) === 0, "Sem bairros neste ambiente.");
    await lista.scrollIntoViewIfNeeded();
    const itens = lista.locator(":scope > li");
    const n = await itens.count();
    const total = (await lista.boundingBox())!.width;
    const ultimo = (await itens.nth(n - 1).boundingBox())!.width;
    const colunas = largura >= 1024 ? 3 : largura >= 640 ? 2 : 1;
    if (colunas === 2 && n % 2 === 1) expect(ultimo).toBeGreaterThan(total * 0.9);
    // Varredura 23: no computador (6 colunas de 2), sobra 1 → o último ocupa a linha; sobra 2 → os dois dividem a linha.
    if (colunas === 3 && n % 3 === 1) expect(ultimo).toBeGreaterThan(total * 0.9);
    if (colunas === 3 && n % 3 === 2) {
      expect(ultimo).toBeGreaterThan(total * 0.4);
      expect(ultimo).toBeLessThan(total * 0.6);
    }
    if (colunas === 3 && n % 3 === 0) expect(ultimo).toBeLessThan(total * 0.4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await lista.screenshot({ path: `tests/laboratorio/saida/t816-bairros-${largura}.png` });
  });
}
