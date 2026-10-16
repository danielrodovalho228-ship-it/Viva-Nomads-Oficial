import { test, expect } from "@playwright/test";

/**
 * T141 — Galeria do imóvel (ordem e8e901b8, P0 Daniel 16/10):
 * (b) em 1920 e 2560 px o mosaico mede ~1480×480 e fica centralizado;
 * (a) cada foto (grande, 4 miniaturas, "+N mais") abre o lightbox com <img> de altura > 200 px
 *     e contador no índice certo, em 1920 e 390 px.
 * ube-001 tem 8 fotos: o mosaico mostra 5 e o "+3 mais" abre na 6ª.
 */
const IMOVEL = "/imoveis/ube-001";
const TOTAL = 8;

for (const largura of [1920, 2560]) {
  test(`${largura} px: mosaico 1480×480 centralizado`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 1100 });
    await page.goto(IMOVEL, { waitUntil: "networkidle" });
    const m = (await page.getByTestId("galeria-mosaico").boundingBox())!;
    expect(m.width).toBeGreaterThanOrEqual(1460);
    expect(m.width).toBeLessThanOrEqual(1500);
    expect(Math.abs(m.height - 480)).toBeLessThanOrEqual(4);
    expect(Math.abs(m.x - (largura - (m.x + m.width)))).toBeLessThanOrEqual(2);
    await page.screenshot({ path: `test-results/t141-mosaico-${largura}.png` });
  });
}

const casos: [string, number][] = [
  ["galeria-tile-0", 1],
  ["galeria-tile-1", 2],
  ["galeria-tile-2", 3],
  ["galeria-tile-3", 4],
  ["galeria-mais", 6],
];

async function conferirFoto(page: import("@playwright/test").Page, id: string, esperado: number) {
  await page.goto(IMOVEL, { waitUntil: "networkidle" });
  await page.getByTestId(id).locator("visible=true").first().click();
  await expect(page.getByTestId("galeria-contador")).toHaveText(`${esperado} / ${TOTAL}`);
  const img = page.getByTestId("galeria-lightbox").locator("img").first();
  await expect(img).toBeVisible();
  await expect.poll(async () => (await img.boundingBox())?.height ?? 0).toBeGreaterThan(200);
}

test.describe("1920 px", () => {
  test.use({ viewport: { width: 1920, height: 1100 } });
  for (const [id, esperado] of casos) {
    test(`${id}: lightbox mostra a foto ${esperado}/${TOTAL} com altura > 200 px`, async ({ page }) => {
      await conferirFoto(page, id, esperado);
    });
  }
});

test.describe("390 px", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  for (let i = 0; i < 3; i++) {
    test(`foto ${i + 1}: lightbox com altura > 200 px`, async ({ page }) => {
      await page.goto(IMOVEL, { waitUntil: "networkidle" });
      await page.getByTestId("galeria-tile-0").locator("visible=true").first().click();
      for (let k = 0; k < i; k++) await page.getByRole("button", { name: "Próxima foto" }).click();
      await expect(page.getByTestId("galeria-contador")).toHaveText(`${i + 1} / ${TOTAL}`);
      const img = page.getByTestId("galeria-lightbox").locator("img").first();
      await expect.poll(async () => (await img.boundingBox())?.height ?? 0).toBeGreaterThan(200);
    });
  }
});
