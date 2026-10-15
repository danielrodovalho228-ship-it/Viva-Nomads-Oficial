import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T95 — Sem mensalidade (ordem 90181c57, #93): a Viva cobra só comissão.
 * /dashboard/assinatura redireciona o dono logado a /precos, e o menu do dono
 * não oferece "Plano e assinatura" nem botão de assinar em nenhuma tela visitada.
 */
test.describe("T95 — Assinatura aposentada @criticos", () => {
  test.use({ storageState: authFile("proprietario"), viewport: { width: 390, height: 844 } });

  test("/dashboard/assinatura leva a /precos, sem plano pago à venda", async ({ page }) => {
    await page.goto("/dashboard/assinatura", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/precos$/);
    await expect(page.getByRole("button", { name: /Assinar (Essencial|Profissional)/i })).toHaveCount(0);
    await expect(page.getByText("Visualizar como plano (demonstração)")).toHaveCount(0);
  });

  test("Visão geral do dono não tem 'Plano e assinatura' no menu", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: /Plano e assinatura/i })).toHaveCount(0);
    const rolagem = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(rolagem).toBeLessThanOrEqual(1);
  });
});
