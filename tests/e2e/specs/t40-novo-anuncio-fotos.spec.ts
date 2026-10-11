import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/** "Novo anúncio" abre o cadastro pela etapa Fotos (ordem do Moacir, P1). */
test.describe("T-NOVO — Novo anúncio começa pelas Fotos @criticos", () => {
  test.use({ storageState: authFile("proprietario") });

  for (const origem of ["/dashboard", "/dashboard/imoveis"]) {
    test(`botão Novo anúncio em ${origem} leva à tela de Fotos`, async ({ page }) => {
      await page.goto(origem, { waitUntil: "networkidle" });
      await page.getByRole("link", { name: /Novo anúncio/ }).first().click();
      await expect(page).toHaveURL(/\/dashboard\/imoveis\/novo/);
      await expect(page).not.toHaveURL(/qualificar/);
      await expect(page.getByRole("heading", { name: "Fotos do imóvel" })).toBeVisible();
    });
  }
});
