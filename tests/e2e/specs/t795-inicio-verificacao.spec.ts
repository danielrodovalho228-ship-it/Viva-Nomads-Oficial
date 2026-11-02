import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/*
  T795 — varredura 01/11 (Pista A): no Início do painel o botão "Iniciar verificação" / "Continuar verificação" tinha 36 px de altura; agora 44 px. 390 (toque) e 1280.
*/
const SAIDA = "tests/laboratorio/saida";

for (const largura of [390, 1280] as const) {
  test(`T795 — Início: botão de verificação com 44 px (${largura} px)`, async ({ browser }) => {
    const toque = largura === 390;
    const ctx = await browser.newContext({ storageState: authFile("inquilino"), viewport: { width: largura, height: toque ? 844 : 900 }, hasTouch: toque, isMobile: toque });
    const page = await ctx.newPage();
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    const alvos = page.getByRole("link", { name: /(Iniciar|Continuar) verificação/ });
    const n = await alvos.count();
    test.skip(n === 0, "Nada para tocar nesta conta de teste.");
    const alvo = alvos.first();
    await alvo.scrollIntoViewIfNeeded();
    await expect(alvo).toBeVisible();
    const altura = await alvo.evaluate((e) => Math.max(e.getBoundingClientRect().height, parseFloat(getComputedStyle(e, "::after").height) || 0));
    if (toque || true) expect(altura).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `${SAIDA}/t795-inicio-verificacao-${largura}.png` });
    await ctx.close();
  });
}
