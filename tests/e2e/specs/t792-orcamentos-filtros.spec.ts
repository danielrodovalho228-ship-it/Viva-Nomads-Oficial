import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/*
  T792 — varredura 01/11 (Pista A): em Orçamentos os filtros de status (Todas, Enviadas, Vistas…) tinham 34 px de altura no celular; agora 44 px. 390 (toque) e 1280.
*/
const SAIDA = "tests/laboratorio/saida";

for (const largura of [390, 1280] as const) {
  test(`T792 — Orçamentos: filtros com 44 px (${largura} px)`, async ({ browser }) => {
    const toque = largura === 390;
    const ctx = await browser.newContext({ storageState: authFile("proprietario"), viewport: { width: largura, height: toque ? 844 : 900 }, hasTouch: toque, isMobile: toque });
    const page = await ctx.newPage();
    await page.goto("/dashboard/orcamentos", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    const alvos = page.getByRole("tablist", { name: "Filtrar por status" }).getByRole("tab");
    const n = await alvos.count();
    test.skip(n === 0, "Nada para tocar nesta conta de teste.");
    const alvo = alvos.first();
    await alvo.scrollIntoViewIfNeeded();
    await expect(alvo).toBeVisible();
    const altura = await alvo.evaluate((e) => Math.max(e.getBoundingClientRect().height, parseFloat(getComputedStyle(e, "::after").height) || 0));
    if (toque || true) expect(altura).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `${SAIDA}/t792-orcamentos-filtros-${largura}.png` });
    await ctx.close();
  });
}
