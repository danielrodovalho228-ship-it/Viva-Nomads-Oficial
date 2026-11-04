import { test, expect } from "@playwright/test";

/*
  T845 — E505 (D-S1-17): as miniaturas dos temas da Central de Ajuda carregam com resolução suficiente para a caixa de
  80 px numa tela 2× (altura real ≥ 160 px — antes vinha 96 px e o navegador esticava: borrada) e a de "Segurança e
  conta" usa o recorte com o chip do cartão (antes o centro era a parte branca: cinza). 1280 e 390.
*/
for (const largura of [1280, 390] as const) {
  test.describe(`T845 — E505 (${largura}px)`, () => {
    test.use({ viewport: { width: largura, height: 900 }, deviceScaleFactor: 2 });

    test("miniaturas nítidas e o recorte certo", async ({ page }) => {
      await page.goto("/ajuda", { waitUntil: "networkidle" });
      const fotos = page.locator('[data-testid^="ajuda-tema-"] img');
      await expect(fotos).toHaveCount(4);
      await expect.poll(() => fotos.evaluateAll((is) => is.every((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0)), { timeout: 20_000 }).toBe(true);
      const alturas = await fotos.evaluateAll((is) =>
        Promise.all(is.map(async (i) => (await createImageBitmap(await (await fetch((i as HTMLImageElement).currentSrc)).blob())).height))
      );
      for (const h of alturas) expect(h, "altura real da foto servida").toBeGreaterThanOrEqual(160);
      await expect(page.getByTestId("ajuda-tema-seguranca").locator("img")).toHaveCSS("object-position", "35% 50%");
    });
  });
}
