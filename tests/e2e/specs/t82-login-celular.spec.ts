import { test, expect } from "@playwright/test";
import { account, hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, liberarLimiteLoginIp } from "../fixtures/laboratorio";

/**
 * T82 — LOGIN NO CELULAR (ordem c27c7ae6, bug do Daniel no iPhone).
 * Roda no Chromium (390 px) e no WebKit "iPhone 13". Login certo cai no painel
 * em até 5 s com UM único POST /api/auth/entrar (o /token do Supabase é chamado pelo servidor, ordem dddccd2f), o botão fica desabilitado durante a
 * entrada, recarregar o painel continua logado e senha errada mostra a
 * mensagem padrão sem travar.
 */
test.describe("T82 — Login no celular", () => {
  test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 390, height: 844 } });

  // O lab inteiro sai do mesmo IP (limite de login por IP, 40 em 15 min): zera antes de cada teste.
  test.beforeEach(async () => {
    if (NO_LABORATORIO) await liberarLimiteLoginIp();
  });

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
    await page.locator('input[name="email"]').first().fill(`naoexiste-t80-${Date.now()}@example.com`);
    await page.locator('input[name="password"]').first().fill("senha-errada-123");
    const entrar = page.locator("form").getByRole("button", { name: /^entrar$/i });
    await entrar.click();
    // E-mail novo a cada execução: o limite do Supabase por e-mail não acumula entre labs.
    // Se o limite por IP do lab disparar ("Muitas tentativas"), a mensagem amigável também prova o fluxo.
    await expect(page.getByText(/e-mail ou senha|muitas tentativas/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/auth/);
    await expect(page.locator("form").getByRole("button", { name: /^entrar$/i })).toBeEnabled();
  });

  test("login certo: um único POST de login, painel em até 5 s, segue logado ao recarregar", async ({ page }) => {
    test.skip(!hasAccount("inquilino"), "conta de teste não configurada");
    const conta = account("inquilino");
    // Desde a ordem dddccd2f o navegador chama só /api/auth/entrar; quem fala com /auth/v1/token é o servidor.
    let logins = 0;
    let tokensNoNavegador = 0;
    page.on("request", (r) => {
      if (r.method() !== "POST") return;
      if (/\/api\/auth\/entrar/.test(r.url())) logins += 1;
      if (/\/auth\/v1\/token/.test(r.url())) tokensNoNavegador += 1;
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
    expect(logins).toBe(1);
    expect(tokensNoNavegador).toBe(0);
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.waitForTimeout(1_500);
    await expect(page).not.toHaveURL(/\/auth/);
  });
});
