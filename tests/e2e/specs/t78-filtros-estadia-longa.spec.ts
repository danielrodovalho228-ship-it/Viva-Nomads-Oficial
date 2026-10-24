import { test, expect } from "@playwright/test";

/**
 * T78 — ordem 583d2e71: filtros de estadia longa na /buscar. Dois filtros combinados vão para a URL e a
 * lista só diminui; imóvel sem a informação não aparece. FILTROS-2: Wi-Fi e cozinha equipada saíram dos
 * chips (são do padrão mínimo, garantidos em todos) — ficam garagem e máquina de lavar, mais a linha de garantia.
 */
test.describe("T78 — Filtros de estadia longa", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("1280 px: dois filtros combinados vão para a URL e a lista nunca aumenta", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    const total = async () => await page.locator('a[href^="/imoveis/"]').count();
    const antes = await total();
    // Computador (ordem eac7e3a1): os filtros abrem pela busca compacta do cabeçalho.
    await page.getByTestId("busca-compacta").click();
    // Prompt 40: "Mais filtros" abre a folha lateral; a escolha vale ao tocar em "Mostrar N imóveis".
    const aplicar = async (nome: string) => {
      await page.getByRole("button", { name: /Mais filtros/ }).first().click();
      const folha = page.getByRole("dialog", { name: "Filtros" });
      await folha.getByRole("button", { name: nome, exact: true }).click();
      const botao = folha.getByTestId("aplicar-filtros");
      test.skip(await botao.isDisabled(), `Sem imóvel com ${nome} nesta base.`);
      await botao.click();
      await expect(folha).toHaveCount(0);
    };
    await aplicar("Máquina de lavar");
    await expect(page).toHaveURL(/comod=lavar/);
    const um = await total();
    expect(um).toBeLessThanOrEqual(antes);
    await aplicar("Garagem");
    await expect(page).toHaveURL(/comod=lavar(%2C|,)garagem/);
    expect(await total()).toBeLessThanOrEqual(um);
  });

  for (const largura of [360, 390]) {
    test(`${largura} px: painel de filtros tem garagem e lavar, a linha de garantia, grava na URL e não estoura a largura`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 844 });
      await page.goto("/buscar", { waitUntil: "networkidle" });
      await page.getByTestId("abrir-filtros").click();
      const painel = page.getByRole("dialog", { name: "Filtros" });
      const bloco = painel.getByTestId("painel-comodidades");
      for (const nome of ["Garagem", "Máquina de lavar"]) {
        await expect(bloco.getByRole("button", { name: nome, exact: true })).toBeVisible();
      }
      for (const nome of ["Wi-Fi", "Cozinha equipada"]) {
        await expect(bloco.getByRole("button", { name: nome, exact: true })).toHaveCount(0);
      }
      await expect(painel.getByTestId("painel-garantia-minima")).toBeVisible();
      await bloco.getByRole("button", { name: "Garagem", exact: true }).click();
      await bloco.getByRole("button", { name: "Máquina de lavar", exact: true }).click();
      await painel.screenshot({ path: `tests/laboratorio/saida/t78-painel-comodidades-${largura}.png` });
      const aplicar = painel.getByTestId("aplicar-filtros");
      if (await aplicar.isEnabled()) {
        await aplicar.click();
        await expect(page).toHaveURL(/comod=garagem(%2C|,)lavar|comod=lavar(%2C|,)garagem/);
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
