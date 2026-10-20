import { test, expect, type Page } from "@playwright/test";

/**
 * T157 — Lote busca (ordem 826719b1, D1/D5/D12), pública, 390 e 1280 px.
 * D1: "Até R$ 2.500" não mostra anúncio de total maior; D5: Limpar filtros zera a descrição e os chips;
 * D12: clicar no coração favorita SEM navegar para o anúncio.
 */
const brl = (t: string) => Number((t.match(/R\$\s*([\d.]+)/)?.[1] ?? "0").replace(/\./g, ""));

async function totaisDosCartoes(page: Page): Promise<number[]> {
  const txt = await page.getByTestId("cartao-total-mes").allInnerTexts();
  return txt.map(brl).filter((n) => n > 0);
}

for (const largura of [390, 1280]) {
  test.describe(`T157 — Lote busca (${largura} px)`, () => {
    test.use({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });

    test("filtro de preço vale para o total do mês do cartão", async ({ page }) => {
      await page.goto("/buscar?preco=2500", { waitUntil: "networkidle" });
      const totais = await totaisDosCartoes(page);
      for (const t of totais) expect(t).toBeLessThanOrEqual(2500);
    });

    test("Limpar filtros zera o campo de descrição e os chips", async ({ page }) => {
      await page.goto("/buscar", { waitUntil: "networkidle" });
      const campo = page.getByLabel("Descreva o lugar ideal");
      await campo.fill("2 quartos, aceita gato, até 2.500");
      await page.getByTestId("descricao-aplicar").click();
      await expect(page.getByTestId("descricao-chips")).toBeVisible();
      // Só um dos três "Limpar filtros" aparece em cada largura (celular: abaixo dos chips; computador: barra ou painel).
      await page.locator('[data-testid^="limpar-filtros"]:visible').first().click();
      await expect(page.getByTestId("descricao-chips")).toHaveCount(0);
      await expect(campo).toHaveValue("");
    });

    test("clicar no coração favorita sem navegar", async ({ page }) => {
      await page.goto("/buscar", { waitUntil: "networkidle" });
      const url = page.url();
      const coracao = page.getByRole("button", { name: "Adicionar aos favoritos" }).first();
      await expect(coracao).toBeVisible();
      await coracao.click();
      await expect(page).toHaveURL(url);
      await expect(page.getByRole("button", { name: "Remover dos favoritos" }).first()).toBeVisible();
      // O botão não está dentro de um link.
      expect(await page.locator("a button").count()).toBe(0);
    });
  });
}
