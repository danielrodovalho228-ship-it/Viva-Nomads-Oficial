import { test, expect } from "@playwright/test";

/**
 * T135 — Página do imóvel: galeria e conteúdo contidos numa largura máxima centralizada
 * (padrão Furnished Finder), ordem 4252e0d6. Anúncio de exemplo (ube-001).
 * Celular (≤ 768 px) continua ocupando a largura toda.
 */
const MAX = 1280;

for (const largura of [1280, 1920, 2560]) {
  test(`T135 — ${largura} px: container ≤ ${MAX} px, centralizado, galeria baixa`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 1200 });
    await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
    const caixa = (await page.getByTestId("imovel-largura-total").boundingBox())!;
    expect(caixa.width).toBeLessThanOrEqual(MAX);
    // margens esquerda e direita iguais (≤ 2 px de diferença)
    const esquerda = caixa.x;
    const direita = largura - (caixa.x + caixa.width);
    expect(Math.abs(esquerda - direita)).toBeLessThanOrEqual(2);
    // a galeria (primeira foto) fica dentro do container e com altura limitada
    const galeria = page.getByTestId("galeria-desktop");
    const g = (await galeria.boundingBox())!;
    expect(g.x).toBeGreaterThanOrEqual(caixa.x - 1);
    expect(g.x + g.width).toBeLessThanOrEqual(caixa.x + caixa.width + 1);
    expect(g.height).toBeLessThanOrEqual(530);
  });
}

test("T135 — 390 px: conteúdo ocupa a largura toda", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
  const caixa = (await page.getByTestId("imovel-largura-total").boundingBox())!;
  expect(caixa.x).toBeLessThanOrEqual(1);
  expect(caixa.width).toBeGreaterThanOrEqual(388);
});
