import { test, expect } from "@playwright/test";

/**
 * T99 — Selo "Preço justo" (ordem 4c74ac38, item 2): o critério é explicado em /como-funciona#preco-justo,
 * sem rolagem lateral a 390 px, e o texto público não usa palavras proibidas.
 */
test.describe("T99 — Critério do selo Preço justo", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("explica o critério e não estoura a largura", async ({ page }) => {
    await page.goto("/como-funciona#preco-justo", { waitUntil: "networkidle" });
    const secao = page.locator("#preco-justo");
    await expect(secao.getByRole("heading", { name: /Preço justo/ })).toBeVisible();
    await expect(secao).toContainText("abaixo do equivalente mensal");
    await expect(secao).toContainText("opcional");
    await expect(secao).not.toContainText(/comiss|aluguel|corretagem|intermedia/i);
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sobra).toBeLessThanOrEqual(0);
  });
});
