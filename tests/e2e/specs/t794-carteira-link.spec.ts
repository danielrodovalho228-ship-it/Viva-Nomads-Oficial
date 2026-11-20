import { test, expect } from "@playwright/test";
import { areaDeToque } from "../fixtures/area-toque";
import { authFile } from "../fixtures/auth";

/*
  T794 — varredura 01/11 (Pista A): na Carteira o link solto "Ver pedidos compatíveis" tinha 20 px de altura no celular; ganha a área de 44 px de .alvo-toque sem mudar o visual. 390 (toque) e 1280.
*/
const SAIDA = "tests/laboratorio/saida";

for (const largura of [390, 1280] as const) {
  test(`T794 — Carteira: link com alvo de 44 px (${largura} px)`, async ({ browser }) => {
    const toque = largura === 390;
    const ctx = await browser.newContext({ storageState: authFile("proprietario"), viewport: { width: largura, height: toque ? 844 : 900 }, hasTouch: toque, isMobile: toque });
    const page = await ctx.newPage();
    await page.goto("/dashboard/carteira", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    const alvos = page.getByTestId("carteira-pedidos-compativeis");
    const n = await alvos.count();
    test.skip(n === 0, "Nada para tocar nesta conta de teste.");
    const alvo = alvos.first();
    await alvo.scrollIntoViewIfNeeded();
    await expect(alvo).toBeVisible();
    // E1033: a área de toque REAL (9 pontos da caixa 44×44 com elementFromPoint), não a altura do ::after.
    if (toque) expect((await areaDeToque(alvo)).faltam, "área de toque 44×44").toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `${SAIDA}/t794-carteira-link-${largura}.png` });
    await ctx.close();
  });
}
