import { test, expect } from "@playwright/test";

/*
  T325 — adendo EMPRESAS-A: as 7 fotos dos cartões de seção (PR #1144) ligadas em /empresas (3) e /para-proprietarios
  (4), sem fundo neutro pendente. E265 (30/10): sem o selo "Imagem ilustrativa" por cima da foto. A 390 e 1280 px, sem
  rolagem lateral, com a imagem carregada de verdade e print.
*/
const PAGINAS = [
  { rota: "/empresas", fotos: 3 },
  { rota: "/para-proprietarios", fotos: 4 },
] as const;
const SAIDA = "tests/laboratorio/saida";

test.describe("T325 — fotos ilustrativas dos cartões de seção", () => {
  for (const pg of PAGINAS) {
    for (const w of [390, 1280]) {
      test(`${pg.rota} a ${w} px: ${pg.fotos} fotos carregadas, nenhuma com selo por cima`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
        await page.goto(pg.rota, { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("cartao-foto-pendente")).toHaveCount(0);
        // As fotos dos cartões de seção carregam de verdade e nenhuma leva selo por cima.
        const fotos = page.locator('img[src*="unicas%2Fempresas-"], img[src*="unicas%2Fproprietarios-"], img[src*="unicas/empresas-"], img[src*="unicas/proprietarios-"]');
        await expect(fotos).toHaveCount(pg.fotos, { timeout: 20_000 });
        for (let i = 0; i < pg.fotos; i++) {
          const img = fotos.nth(i);
          await img.scrollIntoViewIfNeeded();
          await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: 15_000 }).toBe(true);
        }
        await expect(page.getByTestId("selo-ilustrativa")).toHaveCount(0);
        await expect(page.getByText("Imagem ilustrativa", { exact: true })).toHaveCount(0);
        const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(sobra).toBeLessThanOrEqual(1);
        await fotos.first().scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${SAIDA}/t325${pg.rota.replace("/", "-")}-${w}.png` });
      });
    }
  }
});
