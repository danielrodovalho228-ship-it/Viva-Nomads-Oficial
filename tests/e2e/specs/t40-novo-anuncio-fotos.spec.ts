import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/** "Novo anúncio" abre o cadastro pelo passo 1, "Endereço e dados" (prompt 10: CEP primeiro; Prompt 43: 6 passos). */
test.describe("T-NOVO — Novo anúncio começa por Endereço e dados @criticos", () => {
  test.use({ storageState: authFile("proprietario") });

  for (const origem of ["/dashboard", "/dashboard/imoveis"]) {
    test(`botão Novo anúncio em ${origem} leva ao passo Endereço e dados`, async ({ page }) => {
      await page.goto(origem, { waitUntil: "domcontentloaded" });
      await page.getByRole("link", { name: /Novo anúncio/ }).first().click();
      await expect(page).toHaveURL(/\/dashboard\/imoveis\/novo/);
      await expect(page).not.toHaveURL(/qualificar/);
      await expect(page.getByRole("heading", { name: "Endereço e dados" })).toBeVisible();
    });
  }

  test("/qualificar sem imóvel redireciona para o cadastro (passo Endereço e dados)", async ({ page }) => {
    await page.goto("/qualificar", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard\/imoveis\/novo/);
    await expect(page.getByRole("heading", { name: "Endereço e dados" })).toBeVisible();
  });

  test("estado vazio de Meus imóveis oferece cadastrar pelas fotos", async ({ page }) => {
    await page.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
    const vazio = page.getByText("Comece pelas fotos do seu imóvel");
    test.skip((await vazio.count()) === 0, "conta de teste já tem imóveis");
    await page.getByRole("link", { name: "Cadastrar imóvel" }).click();
    await expect(page).toHaveURL(/\/dashboard\/imoveis\/novo/);
  });
});
