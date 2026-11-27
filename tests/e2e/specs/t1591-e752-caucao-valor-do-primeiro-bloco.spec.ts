import { test, expect } from "@playwright/test";

/**
 * T1591 — GUARDA DO E752 (#3579, merge na main em 09/11): no anúncio, a Caução mostra o VALOR do 1º bloco ("Caução do 1º bloco
 * (N meses)" + "R$ …", pela regra do contrato: 50% do bloco, no máximo 3 vezes o valor mensal) e o texto público diz que ela é
 * "paga direto ao proprietário" e que "a Viva não recebe nem segura esse dinheiro" — sem a antiga promessa de "poupança" na linha da Caução.
 * Anúncio de exemplo da casa (ube-001), sem login nem banco, a 390 e 1280 px, sem rolagem lateral. O texto é lido no DOM
 * (vale com o cartão aberto ou em folha).
 */
for (const largura of [390, 1280]) {
  test.describe(`T1591 — E752: Caução com o valor do 1º bloco e o texto público novo (${largura}px)`, () => {
    test.use({ viewport: { width: largura, height: 900 } });

    test("ube-001: rótulo com o bloco, valor em reais, nota 'direto ao proprietário', sem 'poupança'", async ({ page }) => {
      await page.goto("/imoveis/ube-001", { waitUntil: "domcontentloaded" });
      await expect(page.locator("h1").first()).toBeVisible();
      const caucao = page.getByTestId("taxas-itemizadas").locator('[data-taxa="caucao"]').first();
      await expect(caucao).toBeAttached();
      await expect(caucao).toContainText(/Caução do 1º bloco \(\d+ (mês|meses)\)/);
      await expect(caucao).toContainText(/R\$\s?[\d.]+/);
      await expect(caucao).toContainText("Paga direto ao proprietário");
      await expect(caucao).toContainText("A Viva não recebe nem segura esse dinheiro");
      // O texto antigo ("depositada em poupança") não volta na linha da Caução.
      expect(await caucao.innerText()).not.toMatch(/poupan[çc]a/i);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  });
}
