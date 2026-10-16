import { test, expect } from "@playwright/test";

/**
 * Ordem 87aabd61 — o pacote de limpeza pago entra no custo total do mês. Anúncio de exemplo ube-002
 * (2 limpezas por mês, R$ 180): total R$ 3.130 na página e no cartão; ube-001 segue em R$ 3.960.
 */
for (const largura of [390, 1280]) {
  test.describe(`T155 — Limpeza no total do mês (${largura} px)`, () => {
    test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: largura, height: 900 } });

    test("ube-002: linha de limpeza e total 3.130 na página; ube-001 sem mudança", async ({ page }) => {
      await page.goto("/imoveis/ube-002", { waitUntil: "domcontentloaded" });
      const total = page.getByTestId("total-mensal").first();
      await expect(total.locator('[data-taxa="limpeza"]')).toContainText("Limpeza durante a estadia (2 por mês)");
      await expect(total.locator('[data-taxa="limpeza"]')).toContainText("180");
      await expect(page.getByTestId("total-por-mes").first()).toContainText("3.130");

      await page.goto("/imoveis/ube-001", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("total-mensal").first().locator('[data-taxa="limpeza"]')).toHaveCount(0);
      await expect(page.getByTestId("total-por-mes").first()).toContainText("3.960");
    });

    test("cartão da busca de ube-002 mostra o mesmo total", async ({ page }) => {
      await page.goto("/buscar", { waitUntil: "domcontentloaded" });
      const cartao = page.locator('a[href="/imoveis/ube-002"]').first();
      test.skip((await cartao.count()) === 0, "ube-002 fora da busca deste ambiente");
      await expect(cartao.getByTestId("cartao-total-mes")).toContainText("3.130");
    });
  });
}
