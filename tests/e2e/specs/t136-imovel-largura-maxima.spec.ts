import { test, expect } from "@playwright/test";

/**
 * T136 — Página do imóvel contida em 1536 px (ordens 4252e0d6 e e8e901b8, P0 do Daniel 16/10).
 * Galeria e conteúdo ficam numa coluna central; em 1920/2560 as margens laterais são iguais.
 */
for (const largura of [1920, 2560]) {
  test(`${largura} px: conteúdo e galeria não passam de 1536 px e ficam centralizados`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 1100 });
    await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
    const caixa = (await page.getByTestId("imovel-largura-total").boundingBox())!;
    expect(caixa.width).toBeLessThanOrEqual(1536);
    expect(Math.abs(caixa.x - (largura - (caixa.x + caixa.width)))).toBeLessThanOrEqual(2);
    const galeria = page.locator("main img").first();
    const foto = (await galeria.boundingBox())!;
    expect(foto.x).toBeGreaterThanOrEqual(caixa.x - 1);
    expect(foto.x + foto.width).toBeLessThanOrEqual(caixa.x + caixa.width + 1);
    expect(foto.height).toBeLessThanOrEqual(520);
    expect(caixa.width).toBeGreaterThanOrEqual(1530);
    await page.screenshot({ path: `test-results/t136-${largura}.png` });
  });
}

test("390 px: ocupa a largura toda, sem rolagem lateral", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
  const caixa = (await page.getByTestId("imovel-largura-total").boundingBox())!;
  expect(caixa.width).toBeGreaterThanOrEqual(388);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
