import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { account } from "../fixtures/accounts";
import { gerarCodigoTotp } from "../fixtures/totp";

/**
 * T56 — ADMIN EM AAL2 NO LABORATÓRIO (ordens 99950a2f / 69cd81f4). O /admin exige
 * verificação em duas etapas; o login do admin de teste digita o código TOTP
 * (TESTES_ADMIN_TOTP_SEGREDO) e a sessão salva já está em AAL2.
 * Sem o segredo, a prova não é possível e o teste se pula (nunca passa em falso).
 */
test.describe("T56 — Admin em AAL2", () => {
  test.skip(!process.env.TESTES_ADMIN_TOTP_SEGREDO, "Sem TESTES_ADMIN_TOTP_SEGREDO: o admin de teste não eleva a AAL2.");
  test.use({ storageState: authFile("admin") });

  test("sessão salva do admin entra no /admin sem pedir código", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/admin(\?|$|\/)/);
    await expect(page).not.toHaveURL(/verificar-codigo|conta\/seguranca/);
    // Título do /admin desde o Prompt 46 (37f56a4b, "decisões primeiro"); a t273 confere o resto da tela.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Hoje você tem \d+ decis(ão|ões)$/, { timeout: 25_000 });
  });

  test("visitante anônimo nunca vê o /admin", async ({ browser, baseURL }) => {
    // O Playwright aplica o storageState do describe (admin em AAL2) a TODO contexto novo;
    // sem esvaziar, este "visitante" já chegava logado e ficava em /admin (falso vermelho no lab).
    const ctx = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto("/admin", { waitUntil: "networkidle" });
    await expect(page).not.toHaveURL(/\/admin(\?|$|\/)/); // anônimo nunca vê o /admin
    await ctx.close();
  });

  test("sessão aal1 real (só senha) vai ao código e volta ao destino completo do /admin", async ({ browser, baseURL }) => {
    // Ordens 4a92c972 / b1583238 item 6 (Moacir, PR #426): login SEM passar o código = aal1.
    const ctx = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    const acc = account("admin");
    await page.goto("/auth", { waitUntil: "networkidle" });
    await page.locator('input[name="email"], input[type="email"]').first().fill(acc.email);
    await page.locator('input[name="password"], input[type="password"]').first().fill(acc.senha);
    await page.locator("form").getByRole("button", { name: /^entrar$/i }).click();
    await page.waitForURL(/\/dashboard|\/auth\/verificar-codigo/, { timeout: 20_000 });

    await page.goto("/admin/usuarios", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/auth\/verificar-codigo/); // aal1 não entra no /admin
    await page.locator("#codigo-2fa").fill(gerarCodigoTotp(process.env.TESTES_ADMIN_TOTP_SEGREDO as string));
    await page.getByRole("button", { name: /confirmar e entrar/i }).click();
    await page.waitForURL(/\/admin\/usuarios/, { timeout: 20_000 }); // volta ao destino completo
    await ctx.close();
  });
});
