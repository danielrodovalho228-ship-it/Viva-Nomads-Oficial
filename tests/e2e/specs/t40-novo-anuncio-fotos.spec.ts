import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { noPasso } from "../fixtures/cadastro";

/** "Novo anúncio" abre o cadastro pelo passo 1 (assistente em 10 passos: o Tipo; antes, "Endereço e dados" dos 6 passos). */
test.describe("T-NOVO — Novo anúncio começa pelo passo 1 (Tipo) @criticos", () => {
  test.use({ storageState: authFile("proprietario") });

  for (const origem of ["/dashboard", "/dashboard/imoveis"]) {
    test(`botão Novo anúncio em ${origem} leva ao passo 1 (Tipo)`, async ({ page }) => {
      await page.goto(origem, { waitUntil: "domcontentloaded" });
      await page.getByRole("link", { name: /Novo anúncio/ }).first().click();
      await expect(page).toHaveURL(/\/dashboard\/imoveis\/novo/);
      await expect(page).not.toHaveURL(/qualificar/);
      await noPasso(page, "tipo");
    });
  }

  test("/qualificar sem imóvel redireciona para o cadastro (passo 1, Tipo)", async ({ page }) => {
    await page.goto("/qualificar", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard\/imoveis\/novo/);
    await noPasso(page, "tipo");
  });

  test("estado vazio de Meus imóveis oferece cadastrar pelas fotos", async ({ page }) => {
    await page.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
    const vazio = page.getByText("Comece pelas fotos do seu imóvel");
    test.skip((await vazio.count()) === 0, "conta de teste já tem imóveis");
    await page.getByRole("link", { name: "Cadastrar imóvel" }).click();
    await expect(page).toHaveURL(/\/dashboard\/imoveis\/novo/);
  });
});
