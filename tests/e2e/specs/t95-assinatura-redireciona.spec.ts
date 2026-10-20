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
    await page.goto("/dashboard/assinatura", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/precos$/);
    await expect(page.getByRole("button", { name: /Assinar (Essencial|Profissional)/i })).toHaveCount(0);
    await expect(page.getByText("Visualizar como plano (demonstração)")).toHaveCount(0);
  });

  for (const [largura, altura] of [[390, 844], [1280, 800]] as const) {
    test(`menu do dono a ${largura} px não tem 'Plano e assinatura' (menu realmente aberto)`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: altura });
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      if (largura < 768) await page.getByRole("button", { name: "Abrir menu" }).click();
      const menu = page.locator("aside").filter({ has: page.getByTestId("menu-cascata") }).last();
      // Prova positiva: o menu está de fato visível, com itens, antes de afirmar a ausência.
      await expect(menu).toBeVisible();
      await expect(menu.getByRole("link", { name: "Visão geral" }).first()).toBeVisible();
      // Abre todos os grupos para não esconder o item dentro de um submenu fechado.
      const grupos = menu.locator("button[aria-expanded='false']");
      for (let n = await grupos.count(); n > 0; n--) await grupos.first().click();
      await expect(menu.getByRole("link", { name: /Plano e assinatura/i })).toHaveCount(0);
      await expect(menu.locator("a[href^='/dashboard/assinatura']")).toHaveCount(0);
      const rolagem = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(rolagem).toBeLessThanOrEqual(1);
    });
  }
});
