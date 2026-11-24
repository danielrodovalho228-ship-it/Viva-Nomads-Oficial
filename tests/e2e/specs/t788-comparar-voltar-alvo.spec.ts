import { test, expect } from "@playwright/test";
import { areaDeToque } from "../fixtures/area-toque";

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
    // E1033: a área de toque REAL (9 pontos da caixa 44×44 com elementFromPoint), não a altura do ::after.
    if (toque) expect((await areaDeToque(link)).faltam, "Voltar à busca: área de toque 44×44").toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `${SAIDA}/t788-comparar-${largura}.png` });
    await link.click();
    await expect(page).toHaveURL(/\/buscar/);
    await ctx.close();
  });
}
