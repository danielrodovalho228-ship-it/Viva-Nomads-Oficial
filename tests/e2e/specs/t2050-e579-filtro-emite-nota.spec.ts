import { test, expect, type Page } from "@playwright/test";

/*
  T2050 — E579 (Pista 3, cobertura do mapa das 142; autorizado pelo Gerente em 15/11) @E579 @ao-vivo-seguro
  Regra: o filtro "Emite nota fiscal" (?nota=1, E574) da /buscar deixa passar os anúncios de dono PJ que declarou emitir
  nota — antes dava SEMPRE 0. O chip mostra o número certo, e ao aplicar a lista mostra exatamente esses anúncios.
  Visitante, só leitura, com o que houver no alvo (sem nenhum declarante, diz por que não roda). O caso que dava 0 é
  semeado no laboratório pelo t2085-e579-filtro-emite-nota-lab (sem a etiqueta: cria conta e anúncio pela chave de serviço).
*/
test.use({ storageState: { cookies: [], origins: [] } });

async function abrirFolha(page: Page) {
  const folha = page.getByTestId("painel-filtros");
  await expect(async () => {
    if (!(await folha.isVisible())) await page.getByTestId("pilula-mais").click({ timeout: 5_000 });
    await expect(folha).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  return folha;
}

test.describe("T2050 — E579: o filtro Emite nota fiscal encontra os anúncios do dono declarante @E579 @ao-vivo-seguro", () => {
  test("chip com N ≥ 1 → aplicar → ?nota=1 e a lista com exatamente N anúncios", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("card-resultado").first()).toBeVisible({ timeout: 30_000 });
    const folha = await abrirFolha(page);
    const chip = folha.getByTestId("faceta-nota");
    await expect(chip).toBeVisible();
    const n = Number(await chip.getAttribute("data-n"));
    test.skip(n === 0, "Nenhum anúncio de dono declarante neste alvo: a regra só se prova com um (o laboratório semeia no -lab).");
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(folha.getByTestId("aplicar-filtros")).toHaveAttribute("data-total", String(n));
    await folha.getByTestId("aplicar-filtros").click();
    await expect(page).toHaveURL(/[?&]nota=1(&|$)/);
    await expect(page.getByTestId("card-resultado")).toHaveCount(n, { timeout: 15_000 });
  });
});
