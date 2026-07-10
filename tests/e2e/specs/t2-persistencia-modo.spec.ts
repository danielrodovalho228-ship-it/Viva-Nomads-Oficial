import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T2 — PERSISTÊNCIA DE MODO (@criticos) — regressão do B1, a mais importante.
 * O modo (Proprietário ⇄ Inquilino) é PREFERÊNCIA DE PERFIL: alternar grava no
 * servidor; refresh, deep-link e nova aba mantêm. Deep-link a rota exclusiva de
 * proprietário abre no modo certo (nunca cai na visão de inquilino).
 */
test.describe("T2 — Persistência de modo @criticos", () => {
  test.use({ storageState: authFile("proprietario") });

  async function trocarPara(page: import("@playwright/test").Page, alvo: RegExp) {
    await page.getByRole("tab", { name: alvo }).click();
    await expect(page.locator("aside")).toContainText(/Modo:/);
  }

  test("alternar modo + F5 mantém a escolha", async ({ page }) => {
    await page.goto("/dashboard");
    // Alterna para Inquilino, recarrega, confirma que MANTÉM.
    await trocarPara(page, /Inquilino/i);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator("aside")).toContainText(/Modo:\s*Inquilino/i);
    // Volta para Proprietário, recarrega, confirma que MANTÉM.
    await trocarPara(page, /Propriet/i);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator("aside")).toContainText(/Modo:\s*Propriet/i);
  });

  test("deep-link /dashboard/ferramentas abre no modo Proprietário, dentro da casca, sem redirect", async ({
    page,
  }) => {
    // Garante que a última preferência é Proprietário e vai direto pela URL.
    await page.goto("/dashboard");
    await trocarPara(page, /Propriet/i);
    await page.goto("/dashboard/ferramentas", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/dashboard\/ferramentas/); // não foi expulso
    await expect(page.locator("aside nav")).toBeVisible(); // dentro da casca
    await expect(page.locator("aside")).toContainText(/Modo:\s*Propriet/i);
  });

  test("nova aba (mesma sessão) mantém o modo", async ({ page, context }) => {
    await page.goto("/dashboard");
    await trocarPara(page, /Inquilino/i);
    const aba2 = await context.newPage();
    await aba2.goto("/dashboard", { waitUntil: "networkidle" });
    await expect(aba2.locator("aside")).toContainText(/Modo:\s*Inquilino/i);
    await aba2.close();
  });

  test("B3 — página pública com sessão não mostra 'Entrar'", async ({ page }) => {
    await page.goto("/home", { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: /Meu painel/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /^Entrar$/ })).toHaveCount(0);
  });
});
