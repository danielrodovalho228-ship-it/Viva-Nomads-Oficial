import { test, expect } from "@playwright/test";
import { account, hasAccount } from "../fixtures/accounts";

/**
 * T82 — LOGIN NO CELULAR (ordem c27c7ae6, bug do Daniel no iPhone).
 * Roda no Chromium (390 px) e no WebKit "iPhone 13". Login certo cai no painel
 * em até 5 s com UM único POST /token, o botão fica desabilitado durante a
 * entrada, recarregar o painel continua logado e senha errada mostra a
 * mensagem padrão sem travar.
 */
test.describe("T82 — Login no celular", () => {
  test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 390, height: 844 } });

  test("campo de e-mail sem autocorreção do iPhone", async ({ page }) => {
    await page.goto("/auth");
    const campo = page.locator('input[name="email"]').first();
    await expect(campo).toHaveAttribute("autocapitalize", "none");
    await expect(campo).toHaveAttribute("autocorrect", "off");
    await expect(campo).toHaveAttribute("spellcheck", "false");
    await expect(campo).toHaveAttribute("inputmode", "email");
  });

  test("senha errada: mensagem padrão, botão volta a funcionar", async ({ page }) => {
    await page.goto("/auth");
    await page.locator('input[name="email"]').first().fill("naoexiste-t80@example.com");
    await page.locator('input[name="password"]').first().fill("senha-errada-123");
    const entrar = page.locator("form").getByRole("button", { name: /^entrar$/i });
    await entrar.click();
    await expect(page.getByText(/e-mail ou senha/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/auth/);
    await expect(page.locator("form").getByRole("button", { name: /^entrar$/i })).toBeEnabled();
  });

  test("login certo: um único POST /token, painel em até 5 s, segue logado ao recarregar", async ({ page }) => {
    test.skip(!hasAccount("inquilino"), "conta de teste não configurada");
    const conta = account("inquilino");
    let tokens = 0;
    page.on("request", (r) => {
      if (r.method() === "POST" && /\/auth\/v1\/token/.test(r.url())) tokens += 1;
    });
    await page.goto("/auth");
    await page.locator('input[name="email"]').first().fill(conta.email);
    await page.locator('input[name="password"]').first().fill(conta.senha);
    const botao = page.locator("form").getByRole("button", { name: /^entrar$/i });
    const t0 = Date.now();
    await botao.click();
    // Durante a entrada o botão não volta a ficar clicável (sem clique duplo).
    await expect(page.locator("form").getByRole("button", { name: /entrando/i })).toBeDisabled();
    await page.waitForURL(/\/dashboard/, { timeout: 5_000 });
    expect(Date.now() - t0).toBeLessThan(5_000);
    expect(tokens).toBe(1);
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.waitForTimeout(1_500);
    await expect(page).not.toHaveURL(/\/auth/);
  });
});
