import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T97 — "Ver planos" das ferramentas bloqueadas leva a /precos (ordens 3a136e90 e
 * 90181c57 #93, Moacir 15/10/2026). A Viva não vende mensalidade: o cartão de
 * recurso bloqueado (PlanGate) nunca aponta para /dashboard/assinatura.
 * Se a conta de teste já tiver plano Gestor a ferramenta abre e o teste se pula
 * (nunca passa em falso).
 */
const FERRAMENTAS = ["/dashboard/carteira", "/dashboard/viabilidade"];

test.describe("T97 — PlanGate leva a /precos @criticos", () => {
  test.use({ storageState: authFile("proprietario"), viewport: { width: 390, height: 844 } });

  for (const rota of FERRAMENTAS) {
    test(`${rota}: ferramenta bloqueada → Ver planos → /precos`, async ({ page }) => {
      await page.goto(rota, { waitUntil: "domcontentloaded" });
      const bloqueio = page.getByRole("heading", { name: /Recurso do plano/i });
      const aberta = await bloqueio.waitFor({ state: "visible", timeout: 15_000 }).then(() => false, () => true);
      test.skip(aberta, "Conta de teste com plano que já libera a ferramenta.");

      const ver = page.getByRole("link", { name: "Ver planos" });
      await expect(ver).toHaveAttribute("href", "/precos");
      // Caso negativo: nenhum link da tela aponta para a assinatura aposentada.
      await expect(page.locator('main a[href*="/dashboard/assinatura"]')).toHaveCount(0);
      const rolagem = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(rolagem).toBeLessThanOrEqual(1);

      await ver.click();
      await expect(page).toHaveURL(/\/precos$/);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  }
});
