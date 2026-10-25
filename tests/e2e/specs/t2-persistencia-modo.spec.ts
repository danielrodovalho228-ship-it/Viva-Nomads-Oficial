import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";

/**
 * T2 — CONTA ÚNICA (@criticos). Antes: persistência do modo Proprietário ⇄ Inquilino.
 * Aposentados em 15/10/2026 (ordem a8c05cd0, PR #506): o seletor de modo e o texto "Modo:" no menu
 * lateral NÃO EXISTEM mais, então os 4 testes de troca/persistência de modo não têm o que provar.
 * Ficam as garantias que continuam valendo: rota de dono abre direto na casca, sem troca de modo,
 * e página pública com sessão não mostra "Entrar".
 */
const CONTA_T2 = hasAccount("proprietario_pro") ? "proprietario_pro" : "proprietario";

test.describe("T2 — Conta única, sem seletor de modo @criticos", () => {
  test.describe.configure({ mode: "default" });
  test.use({ storageState: authFile(CONTA_T2) });

  test("não há seletor nem texto de modo no menu lateral", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    // PROP-1 (#1337): no computador o dono não tem barra lateral — a casca é o topo com abas (topo-dono).
    await expect(page.locator('aside nav:visible, [data-testid="topo-dono"]:visible').first()).toBeVisible();
    await expect(page.locator("aside")).not.toContainText(/Modo:/);
    await expect(page.getByTestId("topo-dono")).not.toContainText(/Modo:/);
    await expect(page.getByRole("button", { name: /^Trocar para /i })).toHaveCount(0);
  });

  test("deep-link /dashboard/ferramentas abre dentro da casca, sem redirect", async ({ page }) => {
    await page.goto("/dashboard/ferramentas", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard\/ferramentas/);
    await expect(page.locator('aside nav:visible, [data-testid="topo-dono"]:visible').first()).toBeVisible();
  });

  test("B3 — página pública com sessão não mostra 'Entrar'", async ({ page }) => {
    await page.goto("/home", { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: /Meu painel/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /^Entrar$/ })).toHaveCount(0);
  });
});
