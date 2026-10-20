import { test, expect } from "@playwright/test";

/**
 * T234 — "Ideal para" (ordem 507074ce): linha derivada dos dados do anúncio, na página do imóvel de
 * exemplo ube-001, logo depois da linha-síntese (QA do Prompt 40: saiu do cartão) (mesa + internet, 2 quartos, mobiliado completo, aceita pet).
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

    test("página do imóvel: a linha vem logo depois da síntese; o cartão da busca não a mostra", async ({ page }) => {
      await page.goto("/imoveis/ube-001", { waitUntil: "domcontentloaded" });
      const sintese = (await page.getByTestId("imovel-sintese").boundingBox())!;
      const linha = (await page.getByTestId("ideal-para").first().boundingBox())!;
      expect(linha.y, "Ideal para abaixo da linha-síntese").toBeGreaterThan(sintese.y);
      await page.goto("/buscar?exemplos=1", { waitUntil: "domcontentloaded" });
      const cartao = page.locator('a[href="/imoveis/ube-001"]').first();
      await expect(cartao).toBeVisible();
      await expect(cartao.getByTestId("ideal-para")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    });
  });
}
