import { test, expect } from "@playwright/test";

/*
  T1621 — E870 (Phoenix RELATORIO-020, A-95): as contagens do "Mais filtros" são facetadas. Sem nada marcado, nenhum aviso; ao
  marcar "Aceita pets", o painel diz que os números já contam com os filtros marcados (antes mudavam de base em silêncio).
  Página pública com os 15 exemplos (?exemplos=1), 1280 e 390. (A parte do "até N min" sem rota — A-96 — é coberta pelo unitário, na mesma conta do filtro.)
*/
for (const [largura, altura] of [[1280, 900], [390, 844]] as const) {
  test(`a ${largura} px: o painel avisa quando as contagens já contam com o que está marcado`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: altura });
    await page.goto("/buscar?exemplos=1", { waitUntil: "networkidle" });
    await page.getByTestId("pilula-mais").click();
    const painel = page.getByRole("dialog", { name: "Filtros" });
    await expect(painel).toBeVisible();
    await expect(painel.getByTestId("painel-contagem-facetada")).toHaveCount(0);
    const pets = painel.getByTestId("faceta-pets");
    test.skip(await pets.isDisabled(), "Sem imóvel que aceite pets nesta base.");
    await pets.click();
    await expect(painel.getByTestId("painel-contagem-facetada"), "aviso das contagens facetadas").toBeVisible();
    await expect(painel.getByTestId("painel-contagem-facetada")).toContainText("já contam com os filtros marcados");
  });
}
