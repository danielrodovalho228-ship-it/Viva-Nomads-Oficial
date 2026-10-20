import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { MIN_IMOVEIS_ANALISE_CARTEIRA } from "../../../src/lib/cobranca/regra";

/**
 * T97 — Ferramentas sem trava de plano (prompt 16, antes "PlanGate leva a /precos"):
 *  - /dashboard/viabilidade saiu e leva à Calculadora de ROI;
 *  - a "Análise da carteira" abre a partir de 3 imóveis ATIVOS (regra das faixas). Abaixo disso, a tela diz quantos
 *    faltam — nada de "Faça upgrade", "Ver planos" ou link para a assinatura.
 */
test.describe("T97 — Análise da carteira pela regra das faixas e Viabilidade → ROI @criticos", () => {
  test.use({ storageState: authFile("proprietario") });

  for (const largura of [390, 1280]) {
    test(`${largura}px — viabilidade redireciona; carteira sem trava de plano`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/dashboard/viabilidade", { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/dashboard\/roi-imovel$/);

      await page.goto("/dashboard/carteira", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Análise da carteira" }).first()).toBeVisible({ timeout: 15_000 });
      const corpo = await page.locator("main").innerText();
      expect(corpo).not.toMatch(/Recurso do plano|upgrade|Ver planos|Plano Gestor/i);
      await expect(page.locator('main a[href="/precos"], main a[href*="/dashboard/assinatura"]')).toHaveCount(0);
      if (await page.getByTestId("carteira-fechada").count()) {
        await expect(page.getByTestId("carteira-fechada")).toContainText(`Abre com ${MIN_IMOVEIS_ANALISE_CARTEIRA} imóveis ativos`);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `tests/laboratorio/saida/t97-carteira-${largura}.png`, fullPage: true });
    });
  }
});
