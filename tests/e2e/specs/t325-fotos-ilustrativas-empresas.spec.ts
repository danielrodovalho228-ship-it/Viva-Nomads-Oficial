import { test, expect } from "@playwright/test";

/*
  T325 — adendo EMPRESAS-A: as 7 fotos dos cartões de seção (PR #1144) ligadas em /empresas (3) e /para-proprietarios
  (4), cada uma com o selo "Imagem ilustrativa" no canto, sem fundo neutro pendente. A 390 e 1280 px, sem rolagem
  lateral, com a imagem carregada de verdade e print.
*/
const PAGINAS = [
  { rota: "/empresas", fotos: 3 },
  { rota: "/para-proprietarios", fotos: 4 },
] as const;
const SAIDA = "tests/laboratorio/saida";

test.describe("T325 — fotos ilustrativas dos cartões de seção", () => {
  for (const pg of PAGINAS) {
    for (const w of [390, 1280]) {
      test(`${pg.rota} a ${w} px: ${pg.fotos} fotos carregadas, cada uma com o selo`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
        await page.goto(pg.rota, { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("cartao-foto-pendente")).toHaveCount(0);
        const selos = page.getByTestId("selo-ilustrativa");
        await expect(selos).toHaveCount(pg.fotos, { timeout: 20_000 });
        for (let i = 0; i < pg.fotos; i++) {
          const selo = selos.nth(i);
          await selo.scrollIntoViewIfNeeded();
          await expect(selo).toHaveText("Imagem ilustrativa");
          // O selo fica dentro da foto, no canto de baixo à esquerda, e a foto carregou.
          const caixa = selo.locator("..");
          const img = caixa.locator("img").first();
          await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: 15_000 }).toBe(true);
          const [s, f] = await Promise.all([selo.boundingBox(), caixa.boundingBox()]);
          expect(s!.x - f!.x).toBeLessThanOrEqual(12);
          expect(f!.y + f!.height - (s!.y + s!.height)).toBeLessThanOrEqual(12);
        }
        const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(sobra).toBeLessThanOrEqual(1);
        await selos.first().scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${SAIDA}/t325${pg.rota.replace("/", "-")}-${w}.png` });
      });
    }
  }
});
