import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { account } from "../fixtures/accounts";

/**
 * T52 — F11/F8 (ordens 45d2bf87 e d521da45): o login devolve ao destino com a query
 * e o dono sem ?imovel não cai no questionário.
 *  1. Visitante em /qualificar?imovel=<id> vai a /auth?redirect=%2Fqualificar%3Fimovel%3D<id>.
 *  2. Depois do login, volta a /qualificar?imovel=<id> (não ao /dashboard).
 *  3. Dono logado em /qualificar sem ?imovel nunca fica em /qualificar (vai à lista ou ao cadastro).
 */
const ID = "11111111-2222-4333-8444-555555555555";

test.describe("T52 — Login devolve a /qualificar?imovel=<id>", () => {
  test.describe("visitante", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("é mandado ao login com o destino completo e volta a ele depois de entrar", async ({ page }) => {
      await page.goto(`/qualificar?imovel=${ID}`, { waitUntil: "networkidle" });
      const u = new URL(page.url());
      expect(u.pathname).toBe("/auth");
      expect(u.searchParams.get("redirect")).toBe(`/qualificar?imovel=${ID}`);

      // Entra NA PRÓPRIA página /auth?redirect=… (o loginAs() abre /auth sem a query e perderia o destino).
      const acc = account("proprietario");
      await page.locator('input[name="email"], input[type="email"]').first().fill(acc.email);
      await page.locator('input[name="password"], input[type="password"]').first().fill(acc.senha);
      await page.locator("form").getByRole("button", { name: /^entrar$/i }).click();
      await page.waitForURL(/\/qualificar\?imovel=/, { timeout: 20_000 });
      expect(new URL(page.url()).searchParams.get("imovel")).toBe(ID);
    });
  });

  test.describe("proprietário logado", () => {
    test.use({ storageState: authFile("proprietario") });

    test("/qualificar sem ?imovel não abre o questionário", async ({ page }) => {
      await page.goto("/qualificar", { waitUntil: "networkidle" });
      expect(new URL(page.url()).pathname).not.toBe("/qualificar");
      expect(new URL(page.url()).pathname).toMatch(/^\/dashboard\/imoveis(\/novo)?$/);
    });
  });
});
