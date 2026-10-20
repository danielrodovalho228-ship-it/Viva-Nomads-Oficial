import { test, expect } from "@playwright/test";

/**
 * T106 — Selo "Preço justo" no anúncio de exemplo ube-001 (ordem 3185f08d). Sem login nem banco:
 * o exemplo ganha o selo pelo critério real (valor mensal < equivalente informado) no cartão da /buscar e na página.
 * Outro exemplo (sem valor do Airbnb) não ganha. 360, 390 e 1280 px sem rolagem lateral.
 */
for (const largura of [360, 390, 1280]) {
  test.describe(`T106 — Selo nos exemplos (${largura}px)`, () => {
    test.use({ viewport: { width: largura, height: 900 } });

    test("cartão da busca e página do ube-001 mostram o selo; o selo não quebra linha", async ({ page }) => {
      await page.goto("/buscar?exemplos=1");
      const cartao = page.locator('a[href="/imoveis/ube-001"]').first();
      await expect(cartao).toBeVisible();
      const seloCartao = cartao.getByTestId("selo-preco-justo");
      await expect(seloCartao).toBeVisible();
      const caixa = await seloCartao.boundingBox();
      expect(caixa!.height).toBeLessThan(34); // uma linha só
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      await page.goto("/imoveis/ube-001");
      await expect(page.getByTestId("selo-preco-justo").first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });

    test("outro exemplo, sem valor do Airbnb, não tem selo", async ({ page }) => {
      await page.goto("/imoveis/ube-002");
      await expect(page.locator("h1").first()).toBeVisible();
      await expect(page.getByTestId("selo-preco-justo")).toHaveCount(0);
    });
  });
}
