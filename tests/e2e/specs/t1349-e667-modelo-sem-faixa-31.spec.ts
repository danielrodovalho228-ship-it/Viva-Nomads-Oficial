import { test, expect, type Page } from "@playwright/test";

/*
  T1349 — E667 (draft #3117, Pista A): /modelodenegocio não tem mais a faixa "31+" nem a legenda "31+ segue em 6% até
  negociar" — a última faixa é a do Plano Gestor ("20+"), e a legenda do gráfico fala do Plano Gestor com o texto único.
  Atrás do código dos sócios (SOCIOS_ACCESS_CODE), a 390 e 1280 px, sem estouro horizontal. Spec preparada sobre a branch do
  draft; só roda verde com o conserto presente.
*/
async function entrarComoSocio(page: Page, rota: string) {
  const codigo = process.env.SOCIOS_ACCESS_CODE;
  test.skip(!codigo, "SOCIOS_ACCESS_CODE não definido neste ambiente");
  await page.goto(`/acesso-socios?next=${encodeURIComponent(rota)}`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="codigo"]').fill(codigo!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(new RegExp(`${rota}$`));
}

test.describe("T1349 — E667: modelo de negócio sem a faixa 31+", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: a última faixa é a do Gestor e nenhuma linha fala em 31+ ou 6% até negociar`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await entrarComoSocio(page, "/modelodenegocio");
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      const corpo = await page.locator("body").innerText();
      expect(corpo, "a faixa 31+ saiu").not.toMatch(/\b31\s*\+/);
      expect(corpo).not.toMatch(/segue em 6%/i);
      expect(corpo, "a última faixa do gráfico é a do Gestor").toMatch(/\b20\s*\+/);
      expect(corpo).toMatch(/no limite inferior de cada faixa\.\s*Plano Gestor/i);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    });
  }
});
