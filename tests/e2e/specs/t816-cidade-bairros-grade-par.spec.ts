import { test, expect } from "@playwright/test";

/*
  T816 — varredura 02/11 (Pista A): na página da cidade, os bairros em grade par. A 768 px (2 colunas), com número
  ímpar de bairros, o último ocupa a linha inteira; a 1280 (3 colunas), a regra da Varredura 23 (resto 1: linha inteira;
  resto 2: os dois últimos dividem; resto 0: um terço); a 390 (1 coluna), nada muda. Sem rolagem lateral.
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
    // E744 (asserção alterada, tabela da Fable #3832): a 3 colunas vale a regra da Varredura 23 — resto 1: o último
    // ocupa a linha inteira; resto 2: os dois últimos dividem a linha; resto 0: um terço.
    if (colunas === 3) {
      const resto = n % 3;
      if (resto === 1) expect(ultimo).toBeGreaterThan(total * 0.9);
      else if (resto === 2) {
        const penultimo = (await itens.nth(n - 2).boundingBox())!.width;
        expect(ultimo).toBeGreaterThan(total * 0.4);
        expect(ultimo).toBeLessThan(total * 0.6);
        expect(Math.abs(penultimo - ultimo)).toBeLessThanOrEqual(2);
      } else expect(ultimo).toBeLessThan(total * 0.4);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await lista.screenshot({ path: `tests/laboratorio/saida/t816-bairros-${largura}.png` });
  });
}
