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

  test("/qualificar sem imóvel redireciona para a etapa Fotos", async ({ page }) => {
    await page.goto("/qualificar", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/dashboard\/imoveis\/novo/);
    await expect(page.getByRole("heading", { name: "Fotos do imóvel" })).toBeVisible();
  });

  test("estado vazio de Meus imóveis oferece cadastrar pelas fotos", async ({ page }) => {
    await page.goto("/dashboard/imoveis", { waitUntil: "networkidle" });
    const vazio = page.getByText("Comece pelas fotos do seu imóvel");
    test.skip((await vazio.count()) === 0, "conta de teste já tem imóveis");
    await page.getByRole("link", { name: "Cadastrar imóvel" }).click();
    await expect(page).toHaveURL(/\/dashboard\/imoveis\/novo/);
  });
});
