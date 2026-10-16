import { test, expect } from "@playwright/test";

/**
 * T110 — Selo "Dono verificado" (ordem 36703038). O selo só aparece com verificação REAL.
 * Anúncio de exemplo (ube-001) não tem verificação: o bloco diz só "Proprietário", sem selo,
 * a 390 e 1280 px. O caso positivo (is_verified=true + toque em "o que significa?") está nos
 * testes unitários (src/lib/anuncio/dono-verificado.test.ts); o lab não grava is_verified.
 */
for (const largura of [390, 1280]) {
  test(`T110 — exemplo não ostenta "Dono verificado" a ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
    const bloco = page.locator("section[aria-labelledby='proprietario-title']");
    await expect(bloco).toBeVisible();
    await expect(bloco.getByTestId("selo-dono-verificado")).toHaveCount(0);
    await expect(bloco).not.toContainText(/verificado/i);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });
}
