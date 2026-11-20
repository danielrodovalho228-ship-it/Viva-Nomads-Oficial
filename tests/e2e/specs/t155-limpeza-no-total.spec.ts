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
      await page.goto("/buscar?exemplos=1", { waitUntil: "domcontentloaded" });
      const cartao = page.locator('a[href="/imoveis/ube-002"]').first();
      await expect(cartao).toBeVisible();
      // O total do mês (com a limpeza) é o "R$ X" de "R$ X/mês · R$ Y em N meses" (QA do Prompt 40).
      await expect(cartao.getByTestId("cartao-preco-mes")).toContainText("3.130");
      await expect(cartao.getByTestId("cartao-total-mes")).toContainText("/mês");
    });

    test("ube-002 (exemplo): sem botão de pedir; a explicação aparece e o total 3.130 segue na página (E694)", async ({ page }) => {
      await page.goto("/imoveis/ube-002", { waitUntil: "domcontentloaded" });
      // E694: no anúncio de exemplo os CTAs saem; no lugar, a explicação e a saída para imóveis reais.
      // (O resumo "Total por mês" do passo de candidatura é coberto no anúncio real: t225 e unitários do resumo.)
      await expect(page.getByTestId("exemplo-sem-acoes").first()).toBeVisible();
      await expect(page.getByTestId("exemplo-ver-reais").first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Pedir para morar", exact: true })).toHaveCount(0);
      await expect(page.getByTestId("total-por-mes").first()).toContainText("3.130");
      await page.screenshot({ path: `test-results/t155-exemplo-${largura}.png` });
    });

    if (largura === 390) {
      test("ube-002: barra fixa do celular mostra o total 3.130", async ({ page }) => {
        await page.goto("/imoveis/ube-002", { waitUntil: "domcontentloaded" });
        const barra = page.getByTestId("barra-total");
        await expect(barra).toBeVisible();
        await expect(barra).toContainText("3.130");
        await page.screenshot({ path: "test-results/t155-barra-390.png" });
      });
    }
  });
}
