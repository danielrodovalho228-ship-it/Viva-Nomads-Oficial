import { test, expect } from "@playwright/test";

/*
  T788 — varredura 01/11 (Pista A): em /comparar (sem imóveis escolhidos), "Voltar à busca" tem área de toque de 44 px
  em tela de toque (390) e continua um link de texto (1280). Leva à busca.
*/
const SAIDA = "tests/laboratorio/saida";

for (const largura of [390, 1280] as const) {
  test(`T788 — /comparar: "Voltar à busca" com alvo de 44 px (${largura} px)`, async ({ browser }) => {
    const toque = largura === 390;
    const ctx = await browser.newContext({ viewport: { width: largura, height: toque ? 844 : 900 }, hasTouch: toque, isMobile: toque });
    const page = await ctx.newPage();
    await page.goto("/comparar", { waitUntil: "domcontentloaded" });
    const link = page.getByTestId("comparar-vazio").getByRole("link", { name: "Voltar à busca" });
    await expect(link).toBeVisible();
    const alvo = await link.evaluate((e) => parseFloat(getComputedStyle(e, "::after").height) || e.getBoundingClientRect().height);
    if (toque) expect(alvo).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `${SAIDA}/t788-comparar-${largura}.png` });
    await link.click();
    await expect(page).toHaveURL(/\/buscar/);
    await ctx.close();
  });
}
