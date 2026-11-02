import { test, expect, type Page } from "@playwright/test";

/*
  T815 — varredura 02/11 (Pista A): 404 e perfil do proprietário.
  1. 404: logo e "É proprietário? Anuncie seu imóvel →" com alvo de 44 px no toque (390).
  2. 404 a 768 (2 colunas): 2 destaques, mesma largura, sem buraco; a 1280 (3 colunas), os três lado a lado.
  3. Perfil de exemplo do proprietário: "· N avaliações" com alvo de 44 px no toque.
*/
const SAIDA = "tests/laboratorio/saida";
const alvo = (p: Page, sel: string) =>
  p.locator(sel).first().evaluate((e) => Math.max(e.getBoundingClientRect().height, parseFloat(getComputedStyle(e, "::after").height) || 0));

test.describe("T815 — toque a 390 px", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test("404: logo e link de anunciar com 44 px", async ({ page }) => {
    const r = await page.goto("/pagina-que-nao-existe-t815", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBe(404);
    await expect(page.getByTestId("nao-encontrada-anunciar")).toBeVisible({ timeout: 30_000 });
    expect(await alvo(page, '[data-testid="nao-encontrada-anunciar"]')).toBeGreaterThanOrEqual(44);
    expect(await alvo(page, "header [data-logo]")).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `${SAIDA}/t815-404-390.png`, fullPage: true });
  });
  test("perfil de exemplo: link das avaliações com 44 px", async ({ page }) => {
    const r = await page.goto("/proprietario/exemplo-1", { waitUntil: "domcontentloaded" });
    test.skip(!r || r.status() === 404, "Sem o proprietário de exemplo neste ambiente.");
    await expect(page.getByTestId("perfil-link-avaliacoes")).toBeVisible({ timeout: 30_000 });
    expect(await alvo(page, '[data-testid="perfil-link-avaliacoes"]')).toBeGreaterThanOrEqual(44);
  });
});

for (const [largura, visiveis] of [[768, 2], [1280, 3]] as const) {
  test(`T815 — 404 a ${largura} px: destaques em grade par`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await page.goto("/pagina-que-nao-existe-t815", { waitUntil: "domcontentloaded" });
    const grade = page.getByTestId("nao-encontrada-destaques");
    test.skip((await grade.count()) === 0 || (await grade.locator(":scope > *").count()) < 3, "Sem 3 imóveis em destaque neste ambiente.");
    // Todos os visíveis com a mesma largura (cartões uniformes) e nenhum buraco: 2 em 2 colunas, 3 em 3.
    const larguras = await grade.locator(":scope > *").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width).filter((w) => w > 0));
    expect(larguras).toHaveLength(visiveis);
    expect(Math.max(...larguras) - Math.min(...larguras)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `${SAIDA}/t815-404-${largura}.png`, fullPage: true });
  });
}
