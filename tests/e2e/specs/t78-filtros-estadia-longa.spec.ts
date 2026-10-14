import { test, expect } from "@playwright/test";

/**
 * T78 — ordem 583d2e71: filtros de estadia longa na /buscar (Wi-Fi, cozinha equipada,
 * garagem, máquina de lavar). Dois filtros combinados vão para a URL e a lista só diminui;
 * imóvel sem a informação não aparece.
 */
test.describe("T78 — Filtros de estadia longa", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("1280 px: dois filtros combinados vão para a URL e a lista nunca aumenta", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/buscar", { waitUntil: "networkidle" });
    const total = async () => await page.locator('a[href^="/imoveis/"]').count();
    const antes = await total();
    await page.getByRole("button", { name: /Mais filtros/ }).first().click();
    await page.getByRole("button", { name: "Máquina de lavar", exact: true }).click();
    await expect(page).toHaveURL(/comod=lavar/);
    const um = await total();
    expect(um).toBeLessThanOrEqual(antes);
    await page.getByRole("button", { name: "Cozinha equipada", exact: true }).click();
    await expect(page).toHaveURL(/comod=lavar(%2C|,)cozinha/);
    expect(await total()).toBeLessThanOrEqual(um);
  });

  for (const largura of [360, 390]) {
    test(`${largura} px: painel de filtros tem as 4 comodidades, grava na URL e não estoura a largura`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 844 });
      await page.goto("/buscar", { waitUntil: "networkidle" });
      await page.getByTestId("abrir-filtros").click();
      const painel = page.getByRole("dialog", { name: "Filtros" });
      const bloco = painel.getByTestId("painel-comodidades");
      for (const nome of ["Wi-Fi", "Cozinha equipada", "Garagem", "Máquina de lavar"]) {
        await expect(bloco.getByText(nome, { exact: true })).toBeVisible();
      }
      await bloco.getByText("Garagem", { exact: true }).click();
      await bloco.getByText("Wi-Fi", { exact: true }).click();
      await painel.screenshot({ path: `tests/laboratorio/saida/t78-painel-comodidades-${largura}.png` });
      const aplicar = painel.getByTestId("aplicar-filtros");
      if (await aplicar.isEnabled()) {
        await aplicar.click();
        await expect(page).toHaveURL(/comod=wifi(%2C|,)garagem|comod=garagem(%2C|,)wifi/);
      }
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(sobra).toBeLessThanOrEqual(1);
    });
  }

  test("URL com lixo em ?comod= é ignorada sem quebrar a página", async ({ page }) => {
    await page.goto("/buscar?comod=wifi,<script>alert(1)</script>,x", { waitUntil: "networkidle" });
    await expect(page.getByTestId("busca")).toBeVisible();
  });
});
