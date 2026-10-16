import { test, expect } from "@playwright/test";

/*
  T136 — Fotos dos cartões da home (ordens 0f93aa8c e 5ade9aaa): cada atalho por
  categoria é um cartão com foto própria (carregada, 4:3), cartões da mesma altura,
  6 colunas no desktop e 2 no celular, sem foto repetida e sem rolagem lateral.
*/
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "chromium", "só no projeto do site (chromium)");
});
test.use({ storageState: { cookies: [], origins: [] } });

for (const largura of [1440, 390]) {
  test(`home ${largura}px: cartões com foto, uniformes e em grade par`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura > 500 ? 900 : 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const grade = page.getByTestId("atalhos-categoria");
    await grade.scrollIntoViewIfNeeded();
    const cartoes = grade.getByTestId("atalho-cartao");
    await expect(cartoes.first()).toBeVisible();
    const n = await cartoes.count();
    expect(n).toBeGreaterThan(0);

    const fotos = new Set<string>();
    for (let i = 0; i < n; i++) {
      const img = cartoes.nth(i).locator("img");
      await img.scrollIntoViewIfNeeded();
      await expect
        .poll(() => img.evaluate((im: HTMLImageElement) => im.complete && im.naturalWidth > 0), { timeout: 15_000 })
        .toBe(true);
      const { src, ratio } = await img.evaluate((im: HTMLImageElement) => {
        const r = im.getBoundingClientRect();
        return { src: new URL(im.currentSrc || im.src).searchParams.get("url") ?? im.src, ratio: r.width / r.height };
      });
      expect(src, "foto própria do cartão").toMatch(/\/images\/home\/cartao-/);
      expect(Math.abs(ratio - 4 / 3), `proporção 4:3 (${ratio.toFixed(2)})`).toBeLessThan(0.03);
      expect(fotos.has(src), `foto repetida: ${src}`).toBe(false);
      fotos.add(src);
    }

    const alturas = await cartoes.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
    expect(Math.max(...alturas) - Math.min(...alturas), `alturas ${alturas}`).toBeLessThanOrEqual(1);
    const cols = await grade.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
    expect(cols).toBe(largura > 500 ? 6 : 2);
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sobra).toBeLessThanOrEqual(1);
  });
}
