import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T101 — Admin: o cartão "Usuários" abre a lista (ordem 61454243). A lista não mostra CPF, telefone nem e-mail,
 * o filtro Fundadores funciona e não há rolagem lateral a 360/1280 px.
 */
test.describe("T101 — Admin: lista de usuários", () => {
  test.use({ storageState: authFile("admin") });

  test("cartão Usuários leva a /admin/usuarios", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await page.locator('main a[href="/admin/usuarios"]').first().click();
    await expect(page).toHaveURL(/\/admin\/usuarios$/);
    await expect(page.getByRole("heading", { level: 1, name: "Usuários" })).toBeVisible();
  });

  for (const largura of [360, 1280]) {
    test(`lista sem dado sensível e sem rolagem lateral a ${largura}px`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 800 });
      await page.goto("/admin/usuarios", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("admin-usuarios-lista")).toBeVisible();
      const corpo = page.locator("main");
      await expect(corpo).not.toContainText(/\d{3}\.\d{3}\.\d{3}-\d{2}|@[a-z0-9-]+\.[a-z]{2,}|\(\d{2}\) ?\d{4,5}-?\d{4}/i);
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(sobra).toBeLessThanOrEqual(1);
    });
  }

  test("filtro inválido na URL é ignorado (sem erro)", async ({ page }) => {
    const r = await page.goto("/admin/usuarios?papel=admin&desde=ontem&fundador=1", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1, name: "Usuários" })).toBeVisible();
  });
});
