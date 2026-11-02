import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/*
  T790 — varredura 01/11 (Pista A): em Conta › Segurança o campo de senha e o "olho" (Segure para ver a senha) têm
  44 px de altura, e a fonte do campo é de 16 px no celular (sem zoom do iPhone). 390 e 1280.
*/
const SAIDA = "tests/laboratorio/saida";

test.use({ storageState: authFile("inquilino") });

for (const largura of [390, 1280] as const) {
  test(`T790 — Conta › Segurança: campo de senha com 44 px (${largura} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    await page.goto("/dashboard/conta/seguranca", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    const olho = page.getByRole("button", { name: "Segure para ver a senha" }).first();
    await expect(olho).toBeVisible({ timeout: 15_000 });
    const campo = page.locator('input[type="password"]').first();
    for (const alvo of [campo, olho]) {
      const caixa = await alvo.boundingBox();
      expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    const fonte = await campo.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    expect(fonte).toBeGreaterThanOrEqual(largura === 390 ? 16 : 14);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `${SAIDA}/t790-campo-senha-${largura}.png` });
  });
}
