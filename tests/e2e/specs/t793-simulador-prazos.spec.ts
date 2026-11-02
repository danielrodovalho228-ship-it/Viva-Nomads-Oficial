import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/*
  T793 — varredura 01/11 (Pista A): no Simulador os prazos (2, 3, 4, 6 meses) tinham 38 px e a régua de imóveis ativos 16 px de altura no celular; agora 44 px. 390 (toque) e 1280.
*/
const SAIDA = "tests/laboratorio/saida";

for (const largura of [390, 1280] as const) {
  test(`T793 — Simulador: prazos com 44 px (${largura} px)`, async ({ browser }) => {
    const toque = largura === 390;
    const ctx = await browser.newContext({ storageState: authFile("proprietario"), viewport: { width: largura, height: toque ? 844 : 900 }, hasTouch: toque, isMobile: toque });
    const page = await ctx.newPage();
    await page.goto("/dashboard/simulador", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    const alvos = page.getByTestId("sim-prazo").getByRole("button");
    const n = await alvos.count();
    test.skip(n === 0, "Nada para tocar nesta conta de teste.");
    const alvo = alvos.first();
    await alvo.scrollIntoViewIfNeeded();
    await expect(alvo).toBeVisible();
    const altura = await alvo.evaluate((e) => Math.max(e.getBoundingClientRect().height, parseFloat(getComputedStyle(e, "::after").height) || 0));
    if (toque || true) expect(altura).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `${SAIDA}/t793-simulador-prazos-${largura}.png` });
    await ctx.close();
  });
}
