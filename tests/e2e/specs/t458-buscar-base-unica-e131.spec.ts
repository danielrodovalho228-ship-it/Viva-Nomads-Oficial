import { test, expect } from "@playwright/test";

/**
 * T458 — E131 (crítico): a /buscar sem filtro mostrava "1 imóvel" e as pílulas contavam 14. Guarda permanente, a 390 e
 * 1280 px: nenhuma contagem de pílula (Tipo, Preço) passa do total da lista sem filtro, e o título bate com a lista.
 */
const SAIDA = "tests/laboratorio/saida";

for (const [largura, altura] of [[390, 844], [1280, 800]] as const) {
  test(`T458 — /buscar: lista e contagens na mesma base, a ${largura}px`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: largura, height: altura });
    await page.goto("/buscar", { waitUntil: "networkidle" });
    const titulo = page.getByTestId("titulo-busca");
    await expect(titulo).toHaveText(/^\d+ imóve(l|is)/, { timeout: 30_000 });
    const total = Number((await titulo.innerText()).match(/\d+/)![0]);
    await expect(page.getByTestId("card-resultado")).toHaveCount(total);
    for (const pilula of ["pilula-tipo", "pilula-preco"]) {
      await expect(async () => {
        await page.getByTestId(pilula).click({ timeout: 5_000 });
        await expect(page.getByTestId(`painel-${pilula}`)).toBeVisible({ timeout: 5_000 });
      }).toPass({ timeout: 60_000 });
      // A contagem de cada opção vem no texto ("Studio / kitnet · 5").
      const ns = await page
        .getByTestId(`painel-${pilula}`)
        .locator(`button[data-testid^="${pilula}-"]`)
        .evaluateAll((els) => els.map((e) => (e.textContent ?? "").match(/·\s*(\d+)/)?.[1]).filter((x): x is string => !!x).map(Number));
      expect(ns.length, `${pilula}: opções com contagem`).toBeGreaterThan(0);
      for (const n of ns) expect(n, `${pilula}: nenhuma opção conta mais que a lista sem filtro (${total})`).toBeLessThanOrEqual(total);
      await page.keyboard.press("Escape");
    }
    await page.screenshot({ path: `${SAIDA}/t458-buscar-${largura}.png` });
  });
}
