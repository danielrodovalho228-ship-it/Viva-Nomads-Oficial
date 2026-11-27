import { test, expect } from "@playwright/test";

/**
 * T917 — E451 (rodada pública, 02/11): com "Mais filtros" aberto, "Limpar tudo" mudava a prévia e os chips, mas a barra
 * seguia com "Casa" e "Até R$ 5.000", o título com "2 imóveis" e a URL com ?tipo=casa&preco=5000 até tocar "Mostrar".
 * Corrigido junto do E589 (#2698: "Limpar tudo" limpa a busca na hora). Esta guarda cobre o caso do relato — filtros das
 * PÍLULAS (Tipo e Preço) vindos da URL — com a folha ainda aberta: barra, título e URL coerentes sem tocar "Mostrar".
 * 390 e 1280 px. Usa os anúncios de exemplo (precisa de algum resultado para "Casa até R$ 5.000"; sem, se pula).
 */
for (const [largura, altura] of [[390, 844], [1280, 800]] as const) {
  test(`${largura}px — "Limpar tudo" com a folha aberta já limpa barra, título e URL @criticos`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: largura, height: altura });
    await expect(async () => {
      await page.goto("/buscar?tipo=casa&preco=5000", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("pilula-tipo")).toContainText("Casa", { timeout: 5_000 });
    }).toPass({ timeout: 60_000 });
    const titulo = page.locator("h1").first();
    const antes = (await titulo.textContent())?.trim() ?? "";
    test.skip(/^Nenhum/.test(antes), "sem anúncio 'Casa até R$ 5.000' neste ambiente");
    await expect(page.getByTestId("pilula-preco")).toContainText("5.000");

    await page.getByTestId("pilula-mais").click();
    const folha = page.getByTestId("painel-filtros");
    await folha.getByTestId("limpar-tudo").click();

    // A folha segue aberta — e a busca atrás dela já está limpa.
    await expect(folha).toBeVisible();
    await expect(page).not.toHaveURL(/tipo=casa|preco=5000/);
    await expect(page.getByTestId("pilula-tipo")).not.toContainText("Casa");
    await expect(page.getByTestId("pilula-preco")).not.toContainText("5.000");
    await expect(titulo).not.toHaveText(antes);
    await page.screenshot({ path: `tests/laboratorio/saida/t917-e451-${largura}.png` });
  });
}
