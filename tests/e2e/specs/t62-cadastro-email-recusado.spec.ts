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

  test("na entrada única (link antigo de cadastro), @example.com mostra a mensagem específica e nunca a genérica", async ({ page }) => {
    // Prompt 49: ?cadastro=1 cai na entrada única; a conta nasce no código, e o domínio é barrado antes do envio.
    await page.goto("/auth?cadastro=1", { waitUntil: "networkidle" });
    await page.locator('input[name="email"]').fill("qa@example.com");
    await page.getByTestId("entrada-continuar").click();
    const erro = page.getByTestId("auth-erro");
    await expect(erro).toContainText("Não conseguimos usar este e-mail", { timeout: 15_000 });
    await expect(erro).not.toContainText("Não foi possível concluir");
  });
});
