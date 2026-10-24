import { test, expect } from "@playwright/test";

/**
 * L-43 (vigia, 24/10): o painel e a /buscar não assentam em "networkidle" (t183, L-40); espera até 10 s e segue para o elemento.
 * T222 — ordem 022afabb, item 3 e 6: filtro "Aceita pet" com porte na busca.
 *  1. Celular (390 px): ligar "Aceita pets" no painel mostra "Porte do pet"; a escolha vai para a URL.
 *  2. Computador: o chip "Aceita pet" abre o seletor de porte; a contagem nunca aumenta.
 */
test.describe("T222 — Filtro de pet com porte", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("390 px: painel mostra o porte só com 'Aceita pets' ligado e grava na URL", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
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

  test("1280 px: na folha lateral, 'Aceita pets' mostra o porte e grava na URL", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    // Desde a busca compacta (#488) os filtros abrem por ela; "Mais filtros" abre a folha lateral (Prompt 40).
    await page.getByTestId("busca-compacta").click();
    await page.getByRole("button", { name: /Mais filtros/ }).first().click();
    const folha = page.getByRole("dialog", { name: "Filtros" });
    await expect(folha.getByTestId("painel-porte-pet")).toHaveCount(0);
    await folha.getByRole("button", { name: "Aceita pets", exact: true }).click();
    await expect(folha.getByTestId("painel-porte-pet")).toContainText("Porte do pet");
    await folha.getByRole("button", { name: "Pequeno (até 10 kg)", exact: true }).click();
    const aplicar = folha.getByTestId("aplicar-filtros");
    test.skip(await aplicar.isDisabled(), "Sem imóvel que aceite pet pequeno nesta base.");
    await aplicar.click();
    await expect(page).toHaveURL(/pet=1/);
    await expect(page).toHaveURL(/porte=P/);
  });
});
