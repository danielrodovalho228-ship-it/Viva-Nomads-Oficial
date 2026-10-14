import { test, expect } from "@playwright/test";

/** T77 — Clareza UX3 (ordem ae570e76): 5 comodidades + "Ver todas" com a lista completa agrupada. */
for (const largura of [390, 1280]) {
  test.describe(`T77 — comodidades a ${largura}px`, () => {
    test.use({ viewport: { width: largura, height: 900 } });

    test("mostra no máximo 5 e 'Ver todas' abre a lista completa", async ({ page }) => {
      await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
      const bloco = page.getByTestId("comodidades");
      await expect(bloco).toBeVisible();
      expect(await bloco.locator(":scope > ul > li").count()).toBeLessThanOrEqual(5);
      const ver = page.getByTestId("comodidades-ver-todas");
      if (await ver.count()) {
        await ver.click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await expect(page.getByTestId("comodidades-lista-completa").locator("h3").first()).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toHaveCount(0);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    });
  });
}
