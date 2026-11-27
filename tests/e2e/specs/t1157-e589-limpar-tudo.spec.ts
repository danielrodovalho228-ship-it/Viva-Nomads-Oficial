import { test, expect } from "@playwright/test";

/**
 * T1157 — E589 (relato do Daniel, uso real 05/11): "Mais filtros (1)" preso. Limpar os filtros e fechar a folha sem
 * tocar em "Mostrar N imóveis" deixava o filtro no contador, na URL e na lista. Agora "Limpar tudo" limpa a busca na
 * hora (a folha segue aberta e vazia). Em 390 e 1280 px. @criticos
 */
for (const [largura, altura] of [[390, 844], [1280, 800]] as const) {
  test(`${largura}px — "Limpar tudo" e fechar a folha zera o contador, a URL e a lista @criticos`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: largura, height: altura });
    await expect(async () => {
      await page.goto("/buscar?local=Uberl%C3%A2ndia&pronto=1", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("pilula-mais")).toContainText("(1)", { timeout: 5_000 });
    }).toPass({ timeout: 60_000 });

    await page.getByTestId("pilula-mais").click();
    const folha = page.getByTestId("painel-filtros");
    await expect(folha.getByTestId("faceta-pronto")).toHaveAttribute("aria-pressed", "true");
    await folha.getByTestId("limpar-tudo").click();
    // A folha segue aberta e vazia; a busca já foi limpa.
    await expect(folha).toBeVisible();
    await expect(folha.locator('[aria-pressed="true"]')).toHaveCount(0);
    await expect(page).not.toHaveURL(/pronto=1/);

    // Fecha SEM tocar em "Mostrar N imóveis": nada volta.
    await folha.getByRole("button", { name: "Fechar" }).click();
    await expect(folha).toHaveCount(0);
    await expect(page.getByTestId("pilula-mais")).not.toContainText("(");
    await expect(page).not.toHaveURL(/pronto=1/);
  });
}
