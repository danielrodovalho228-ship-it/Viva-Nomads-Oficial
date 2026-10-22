import { test, expect } from "@playwright/test";

/**
 * T267 — D-V da t249 (1280 px): em /buscar, a 1ª foto dos 6 primeiros cartões baixa sem esperar a rolagem
 * (loading="eager"); do 7º cartão em diante segue preguiçosa. A 390 px a regra é a mesma e nada rola de lado.
 */
test.use({ storageState: { cookies: [], origins: [] } });

for (const largura of [390, 1280] as const) {
  test(`${largura}px — /buscar: fotos da primeira dobra sem lazy`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    const cartoes = page.getByTestId("cartao-imovel");
    await expect(cartoes.first()).toBeVisible({ timeout: 25_000 });
    const carregamento = await cartoes.evaluateAll((els) =>
      els.map((el) => el.querySelector<HTMLImageElement>('[data-testid="cartao-foto"] img')?.getAttribute("loading") ?? null),
    );
    const comFoto = carregamento.map((l, i) => ({ l, i })).filter((x) => x.l !== null);
    expect(comFoto.length, "a busca do laboratório tem cartões com foto").toBeGreaterThan(0);
    for (const { l, i } of comFoto) expect(l, `cartão ${i + 1}`).toBe(i < 6 ? "eager" : "lazy");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });
}
