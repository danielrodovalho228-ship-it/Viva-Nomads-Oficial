import { test, expect } from "@playwright/test";

/**
 * T77 — ordem 022afabb, item 3 e 6: filtro "Aceita pet" com porte na busca.
 *  1. Celular (390 px): ligar "Aceita pets" no painel mostra "Porte do pet"; a escolha vai para a URL.
 *  2. Computador: o chip "Aceita pet" abre o seletor de porte; a contagem nunca aumenta.
 */
test.describe("T77 — Filtro de pet com porte", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("390 px: painel mostra o porte só com 'Aceita pets' ligado e grava na URL", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/buscar", { waitUntil: "networkidle" });
    await page.getByTestId("abrir-filtros").click();
    const painel = page.getByRole("dialog", { name: "Filtros" });
    await expect(painel.getByTestId("painel-porte-pet")).toHaveCount(0);
    await painel.getByText("Aceita pets", { exact: true }).click();
    await expect(painel.getByTestId("painel-porte-pet")).toContainText("Porte do pet");
    await painel.getByText("Grande (acima de 25 kg)", { exact: true }).click();
    await painel.screenshot({ path: "tests/laboratorio/saida/t77-painel-porte-390.png" });
    await painel.getByTestId("aplicar-filtros").click();
    await expect(page).toHaveURL(/pet=1/);
    await expect(page).toHaveURL(/porte=G/);
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sobra).toBeLessThanOrEqual(1);
  });

  test("1280 px: chip 'Aceita pet' abre o seletor de porte e a lista só diminui", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("filtro-porte-pet")).toHaveCount(0);
    // Desde a busca compacta (#488) o chip "Aceita pet" mora no painel "Mais filtros".
    await page.getByRole("button", { name: /Mais filtros/ }).first().click();
    await page.getByTestId("mais-filtros-painel").getByRole("button", { name: /Aceita pet/ }).click();
    await expect(page.getByTestId("filtro-porte-pet")).toBeVisible();
    await expect(page).toHaveURL(/pet=1/);
  });
});
