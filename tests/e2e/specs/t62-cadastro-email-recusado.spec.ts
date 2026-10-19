import { test, expect } from "@playwright/test";

/** F2 (ordem d90cbe91): e-mail de domínio reservado mostra a mensagem específica, nunca o genérico. */
test.describe("Cadastro — e-mail recusado (F2)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("@example.com é barrado no servidor antes do signUp", async ({ page }) => {
    const r = await page.request.post("/api/auth/validar-email", { data: { email: "qa@example.com" } });
    const j = await r.json();
    expect(j.ok).toBe(false);
    expect(j.error).toContain("Não conseguimos usar este e-mail");
  });

  test("domínio comum passa na validação", async ({ page }) => {
    const r = await page.request.post("/api/auth/validar-email", { data: { email: "pessoa@gmail.com" } });
    expect((await r.json()).ok).toBe(true);
  });

  test("na tela de cadastro, @example.com mostra a mensagem específica e nunca a genérica", async ({ page }) => {
    await page.goto("/auth?cadastro=1", { waitUntil: "networkidle" });
    await page.getByText("Sou Inquilino").click();
    await page.getByPlaceholder("Nome completo").fill("Pessoa de Teste");
    await page.locator('input[name="email"]').fill("qa@example.com");
    await page.locator('input[name="password"]').fill("SenhaForte#2026");
    await page.locator('input[name="confirm-password"]').fill("SenhaForte#2026");
    await page.getByLabel(/Aceito os Termos de Uso/).check();
    await page.locator("form").getByRole("button", { name: /^(cadastrar|criar conta)/i }).click();
    const erro = page.getByTestId("auth-erro");
    await expect(erro).toContainText("Não conseguimos usar este e-mail", { timeout: 15_000 });
    await expect(erro).not.toContainText("Não foi possível concluir");
  });
});
