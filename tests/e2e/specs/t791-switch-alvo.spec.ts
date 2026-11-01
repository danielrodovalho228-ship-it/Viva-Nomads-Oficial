import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/*
  T791 — varredura 01/11 (Pista A): os interruptores (role=switch) de Notificações têm área de toque de 44 px em tela de
  toque (390) e o mesmo trilho de 24 px no visual; tocar alterna. 390 (toque) e 1280.
*/
const SAIDA = "tests/laboratorio/saida";

for (const largura of [390, 1280] as const) {
  test(`T791 — Notificações: interruptor com alvo de 44 px (${largura} px)`, async ({ browser }) => {
    const toque = largura === 390;
    const ctx = await browser.newContext({ storageState: authFile("inquilino"), viewport: { width: largura, height: toque ? 844 : 900 }, hasTouch: toque, isMobile: toque });
    const page = await ctx.newPage();
    await page.goto("/dashboard/notificacoes", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    const sw = page.getByRole("switch").first();
    await expect(sw).toBeVisible({ timeout: 15_000 });
    const trilho = await sw.boundingBox();
    expect(Math.round(trilho?.height ?? 0)).toBe(24);
    if (toque) {
      const alvo = await sw.evaluate((e) => parseFloat(getComputedStyle(e, "::after").height));
      expect(alvo).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `${SAIDA}/t791-switch-${largura}.png` });
    await ctx.close();
  });
}
