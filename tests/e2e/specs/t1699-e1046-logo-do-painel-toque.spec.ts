import { test, expect } from "@playwright/test";
import { areaDeToque } from "../fixtures/area-toque";
import { authFile } from "../fixtures/auth";

/*
  T1699 — E1046: no celular (390 px, toque), o logo do topo do painel tem 44 px de altura na própria âncora e a área de
  toque real de 44 × 44 (helper do E1033). Antes: 153 × 32 — o mesmo defeito que o E960 corrigiu no site público.
*/
for (const papel of ["inquilino", "proprietario"] as const) {
  test.describe(`T1699 — logo do painel em toque (${papel})`, () => {
    test.use({ storageState: authFile(papel), viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test("o logo do topo do painel tem 44 px e a área de toque real", async ({ page }) => {
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      const logo = page.locator("a[data-logo]:visible").first();
      await expect(logo).toBeVisible({ timeout: 30_000 });
      const caixa = await logo.boundingBox();
      expect(Math.round(caixa?.height ?? 0), "altura do retângulo da âncora do logo").toBeGreaterThanOrEqual(44);
      expect((await areaDeToque(logo)).faltam, "logo do painel: área de toque 44×44").toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    });
  });
}
