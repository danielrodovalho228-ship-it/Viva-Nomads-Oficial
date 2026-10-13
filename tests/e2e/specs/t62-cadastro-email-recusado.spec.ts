import { test, expect } from "@playwright/test";

/** F2 (ordem d90cbe91): e-mail de domínio reservado mostra a mensagem específica, nunca o genérico. */
test.describe("Cadastro — e-mail recusado (F2)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("@example.com é barrado no servidor antes do signUp (a tela só chama o Supabase depois deste "ok")", async ({ page }) => {
    const r = await page.request.post("/api/auth/validar-email", { data: { email: "qa@example.com" } });
    const j = await r.json();
    expect(j.ok).toBe(false);
    expect(j.error).toContain("Não conseguimos usar este e-mail");
  });

  test("domínio comum passa na validação", async ({ page }) => {
    const r = await page.request.post("/api/auth/validar-email", { data: { email: "pessoa@gmail.com" } });
    expect((await r.json()).ok).toBe(true);
  });
});
