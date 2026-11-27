import { test, expect } from "@playwright/test";
import { areaDeToque } from "../fixtures/area-toque";
import { authFile } from "../fixtures/auth";

/*
  T791 — varredura 01/11 (Pista A): os interruptores (role=switch) de Notificações têm área de toque de 44 px em tela de
  toque (390) e o mesmo trilho de 24 px no visual; tocar alterna. 390 (toque) e 1280.
  E1033 (passo 2): a área de 44 px vale também a 1280 px, com rato.
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
    // E1033: a área de toque REAL (9 pontos da caixa 44×44 com elementFromPoint), não a altura do ::after.
    // E1033 (passo 2): nos DOIS perfis. Antes só se media em tela de toque; com rato o alvo real tinha os 24 px do trilho.
    expect((await areaDeToque(sw)).faltam, `interruptor: área de toque 44×44 (${toque ? "toque" : "rato"})`).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `${SAIDA}/t791-switch-${largura}.png` });
    await ctx.close();
  });
}
