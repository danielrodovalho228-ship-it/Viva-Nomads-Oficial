import { test, expect } from "@playwright/test";

/**
 * T234 — "Ideal para" (ordem 507074ce): linha derivada dos dados do anúncio, no cartão da busca
 * e na página do imóvel de exemplo ube-001 (mesa + internet, 2 quartos, mobiliado completo, aceita pet).
 * Máximo de 3, na ordem de prioridade; "Com pet" vem primeiro (Prompt 35A, #910) e "Executivo" é o que cai;
 * sem rolagem lateral a 390 e 1280 px.
 */
for (const largura of [390, 1280]) {
  test.describe(`T234 — Ideal para a ${largura} px`, () => {
    test.use({ viewport: { width: largura, height: 900 } });

    test("página do imóvel mostra no máximo 3 e não estoura a largura", async ({ page }) => {
      await page.goto("/imoveis/ube-001", { waitUntil: "domcontentloaded" });
      const linha = page.getByTestId("ideal-para").first();
      await expect(linha).toContainText("Ideal para: Com pet · Home office · Família");
      await expect(linha).not.toContainText("Executivo");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    });

    test("cartão da busca mostra a linha abaixo do título", async ({ page }) => {
      await page.goto("/buscar?exemplos=1", { waitUntil: "domcontentloaded" });
      const cartao = page.locator('a[href="/imoveis/ube-001"]').first();
      await expect(cartao.getByTestId("ideal-para")).toContainText("Home office");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    });
  });
}
