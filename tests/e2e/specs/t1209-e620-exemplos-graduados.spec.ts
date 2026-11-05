import { test, expect } from "@playwright/test";

/**
 * T1209 — E620 (#2793, 05/11): os anúncios de exemplo passam pelo motor do nível (o mesmo caminho do cadastro) — antes a
 * busca mostrava 0 em Essencial. Resultado do E620: 4 exemplos Essencial (ube-001, 006, 012, 014) e 11 sem nível. A
 * página do exemplo mostra o MESMO nível do cartão. O E620 entrou só com teste de unidade; aqui é a página pública, a
 * 390 e 1280, sem login:
 *   1. as 4 páginas graduadas mostram o bloco do nível com data-nivel="essencial";
 *   2. um exemplo sem nível (ube-002) não aparece como Essencial.
 */
test.use({ storageState: { cookies: [], origins: [] } });
const ESSENCIAIS = ["ube-001", "ube-006", "ube-012", "ube-014"];

for (const w of [390, 1280] as const) {
  test(`exemplos graduados pelo motor: Essencial na página (${w})`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
    for (const id of ESSENCIAIS) {
      await page.goto(`/imoveis/${id}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("nivel-imovel"), `${id}: o bloco do nível`).toHaveAttribute("data-nivel", "essencial", { timeout: 30_000 });
    }
    await page.goto("/imoveis/ube-002", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-testid="nivel-imovel"][data-nivel="essencial"]'), "ube-002 não foi graduado Essencial").toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });
}
