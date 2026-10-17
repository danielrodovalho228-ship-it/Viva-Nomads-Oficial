import { test, expect } from "@playwright/test";

/**
 * Ordem e8838fa3 (D10) — /ajuda tem UMA pergunta sobre virar parceiro, que separa empresa que
 * quer moradia (/empresas) de empresa que quer ser parceira (/parceiros). Público, 390 e 1280 px.
 */
for (const largura of [390, 1280]) {
  test.describe(`T158 — Ajuda: virar parceiro (${largura} px)`, () => {
    test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: largura, height: 844 } });

    test("uma pergunta só, com resposta para os dois tipos de empresa", async ({ page }) => {
      await page.goto("/ajuda", { waitUntil: "domcontentloaded" });
      const perguntas = page.getByRole("button", { name: /virar parceiro/i });
      await expect(perguntas).toHaveCount(1);
      await expect(perguntas).toHaveText("Como posso virar parceiro da Viva?");
      await perguntas.click();
      const lista = page.getByRole("list").filter({ has: perguntas });
      await expect(lista).toContainText("quer moradia para funcionários: /empresas");
      await expect(lista).toContainText("quer ser parceira");
      await expect(lista).toContainText("/parceiros");
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(sobra).toBeLessThanOrEqual(0);
    });

    test("caução na Ajuda segue a página pública (até 3 vezes o valor mensal)", async ({ page }) => {
      await page.goto("/ajuda", { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: /Como funciona a caução/i }).click();
      await expect(page.getByText("Caução de até 3 vezes o valor mensal")).toBeVisible();
      await expect(page.getByText(/50%|cada bloco/)).toHaveCount(0);
    });
  });
}
