import { test, expect } from "@playwright/test";

/*
  T813 — varredura pública 02/11 (Pista A): área de toque a 390 px (e nada quebra a 1280).
  1. Home: tocar na barra "Para onde você vai?" acima da linha do texto foca o campo (o campo tem 48 px).
  2. /como-funciona: as pílulas da sub-navegação têm alvo de 44 px na tela de toque; o desenho segue com ~38 px.
*/
const SAIDA = "tests/laboratorio/saida";

for (const largura of [390, 1280] as const) {
  test.describe(`T813 — área de toque nas páginas públicas (${largura} px)`, () => {
    test.use({ viewport: { width: largura, height: largura === 390 ? 844 : 900 }, hasTouch: largura === 390, isMobile: largura === 390 });

    test("home: o campo de busca ocupa a barra inteira", async ({ page }) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      const campo = page.locator("#busca-principal-local");
      await expect(campo).toBeVisible({ timeout: 30_000 });
      const caixa = await campo.boundingBox();
      expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(44);
      // Toque 4 px abaixo do topo do campo (fora da linha do texto antiga) foca o campo.
      await page.mouse.click((caixa?.x ?? 0) + 20, (caixa?.y ?? 0) + 4);
      await expect(campo).toBeFocused();
      // O contorno do foco fica na barra em pílula, não num retângulo dentro dela.
      expect(await campo.evaluate((e) => getComputedStyle(e).outlineStyle)).toBe("none");
      expect(await page.getByTestId("barra-busca-home").evaluate((e) => getComputedStyle(e).outlineStyle)).toBe("solid");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `${SAIDA}/t813-home-${largura}.png` });
    });

    test("/como-funciona: pílulas com alvo de 44 px no toque", async ({ page }) => {
      await page.goto("/como-funciona", { waitUntil: "domcontentloaded" });
      const nav = page.getByRole("navigation", { name: "Seções desta página" });
      await expect(nav).toBeVisible({ timeout: 30_000 });
      const medidas = await nav.locator("a").evaluateAll((as) =>
        as.map((a) => ({ h: a.getBoundingClientRect().height, alvo: parseFloat(getComputedStyle(a, "::after").height) || 0 })),
      );
      expect(medidas).toHaveLength(3);
      for (const m of medidas) {
        expect(m.h).toBeLessThan(44); // o desenho não muda
        if (largura === 390) expect(m.alvo).toBeGreaterThanOrEqual(44);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await nav.screenshot({ path: `${SAIDA}/t813-como-funciona-${largura}.png` });
    });
  });
}
