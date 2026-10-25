import { test, expect } from "@playwright/test";

/*
  T481 — LOGIN-APPLE (#1369), guarda permanente da Pista C, com a chave da Apple no padrão (desligada):
   1. /auth a 390 e 1280: nenhum botão da Apple, o login por e-mail presente e utilizável (campo e botão de enviar).
   2. O Google presente quando o ambiente liga a chave dele (NEXT_PUBLIC_LOGIN_GOOGLE_ATIVO=on, como a produção); o
      build do laboratório não liga essa chave, então lá o caso fica pulado com o motivo — não é dado como verde.
*/
const GOOGLE_LIGADO = process.env.NEXT_PUBLIC_LOGIN_GOOGLE_ATIVO === "on";
const APPLE_LIGADA = process.env.NEXT_PUBLIC_LOGIN_APPLE_ATIVO === "on" || process.env.TESTES_LOGIN_APPLE === "on";

test.describe("T481 — /auth com a Apple desligada", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const w of [390, 1280]) {
    test(`1. a ${w} px: sem Apple; login por e-mail presente`, async ({ page }) => {
      test.skip(APPLE_LIGADA, "este ambiente liga a chave da Apple");
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto("/auth", { waitUntil: "domcontentloaded" });
      const email = page.locator('input[type="email"], input[name="email"]').first();
      await expect(email).toBeVisible({ timeout: 30_000 });
      await expect(email).toBeEditable();
      await expect(page.getByTestId("login-apple")).toHaveCount(0);
      await expect(page.getByRole("button", { name: /Apple/ })).toHaveCount(0);
      await expect(page.locator("form button[type=submit]").first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `tests/laboratorio/saida/t481-auth-${w}.png`, fullPage: true });
    });
  }

  test("2. Google presente com a chave dele ligada", async ({ page }) => {
    test.skip(!GOOGLE_LIGADO, "build sem NEXT_PUBLIC_LOGIN_GOOGLE_ATIVO=on (o laboratório): o Google só aparece com a chave, como na produção");
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("/auth", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Continuar com Google" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("login-apple")).toHaveCount(0);
  });
});
