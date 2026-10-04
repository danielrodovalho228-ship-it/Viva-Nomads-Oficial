import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T15 — PAINEL DE ADMIN COM DADOS REAIS. Regressão do painel que mostrava
 * números e uma fila de checklists escritos no código (Marcos A., Patrícia L.,
 * Família Souza; "Usuários: 28") e "Aprovado" sem gravar nada.
 */
test.describe("T15 — Admin real", () => {
  test.use({ storageState: authFile("admin") });

  test("/admin não tem dados de exemplo e mostra os números do banco", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Administração" })).toBeVisible();
    const corpo = page.locator("main");
    for (const falso of ["Marcos A.", "Patrícia L.", "Família Souza", "Apto Santa Mônica", "Casa Tibery"]) {
      await expect(corpo).not.toContainText(falso);
    }
    // Cartões de contagem presentes (o valor vem do banco; "—" só sem conexão).
    for (const rotulo of ["Usuários", "Imóveis ativos", "Checklists pendentes", "Documentos pendentes"]) {
      await expect(corpo.getByText(rotulo, { exact: true }).first()).toBeVisible();
    }
    await expect(corpo).not.toContainText("modo demonstração");
  });

  test("moderação de pedidos não usa a janelinha do navegador", async ({ page }) => {
    let abriuPrompt = false;
    page.on("dialog", async (d) => {
      abriuPrompt = true;
      await d.dismiss();
    });
    await page.goto("/admin/pedidos", { waitUntil: "networkidle" });
    const ocultar = page.getByRole("button", { name: /Ocultar/ }).first();
    test.skip((await ocultar.count()) === 0, "nenhum pedido ativo para testar");
    await ocultar.click();
    await expect(page.getByRole("dialog", { name: "Ocultar pedido" })).toBeVisible();
    await page.getByRole("button", { name: "Cancelar" }).click();
    expect(abriuPrompt).toBe(false);
  });
});
