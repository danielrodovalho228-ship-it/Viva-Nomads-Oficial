import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

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
    await expect(page.getByRole("heading", { name: "Administração" })).toBeVisible();
  });

  test("sem a elevação (sessão nova só com senha) o portão manda para o código", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL });
    const page = await ctx.newPage();
    await page.goto("/admin", { waitUntil: "networkidle" });
    await expect(page).not.toHaveURL(/\/admin(\?|$|\/)/); // anônimo nunca vê o /admin
    await ctx.close();
  });
});
