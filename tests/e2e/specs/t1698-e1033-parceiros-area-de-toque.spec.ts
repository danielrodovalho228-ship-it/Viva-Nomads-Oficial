import { test, expect } from "@playwright/test";
import { areaDeToque } from "../fixtures/area-toque";

/*
  T1698 — E1033, passo 3, família "parceiros": os links de /parceiros e de /parceiros/buscar têm a área de toque REAL de
  44 × 44 px (helper do passo 1), em tela de toque (390 px) e com rato (1280 px).
  Antes: nos cartões "Tipos de parceria", os links de uma linha ficavam por baixo da área dos da linha seguinte (6 de 15
  falhavam em toque); com rato nenhum tinha a área, porque a classe antiga só valia em tela de toque.
*/
for (const largura of [390, 1280] as const) {
  const toque = largura === 390;
  test.describe(`T1698 — parceiros: área de toque 44×44 (${largura} px, ${toque ? "toque" : "rato"})`, () => {
    test.use({ viewport: { width: largura, height: toque ? 844 : 900 }, hasTouch: toque, isMobile: toque, storageState: { cookies: [], origins: [] } });

    test("/parceiros: os links dos cartões, o do avaliador e o do credenciamento", async ({ page }) => {
      await page.goto("/parceiros", { waitUntil: "domcontentloaded" });
      const dosCartoes = page.getByTestId("parceiros-tipos").locator("a");
      await expect(dosCartoes.first()).toBeVisible({ timeout: 30_000 });
      const n = await dosCartoes.count();
      expect(n).toBeGreaterThanOrEqual(10);
      for (let i = 0; i < n; i++) {
        const a = dosCartoes.nth(i);
        expect((await areaDeToque(a)).faltam, `cartões: "${(await a.textContent())?.trim()}"`).toEqual([]);
      }
      expect((await areaDeToque(page.getByTestId("parceiros-avaliador").locator("a"))).faltam, "avaliador credenciado").toEqual([]);
      expect((await areaDeToque(page.getByTestId("sp-convite-avaliacao").locator("a"))).faltam, "passos do credenciamento").toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    });

    test("/parceiros/buscar: o link \"Seja parceiro da Viva\"", async ({ page }) => {
      await page.goto("/parceiros/buscar", { waitUntil: "domcontentloaded" });
      const link = page.getByTestId("buscar-seja-parceiro").locator("a");
      await expect(link).toBeVisible({ timeout: 30_000 });
      expect((await areaDeToque(link)).faltam, "seja parceiro").toEqual([]);
    });
  });
}
