import { test, expect } from "@playwright/test";

/**
 * T170 — ordem d250ea2f, item 4 + Prompt 49 (entrada única): /auth abre direto no e-mail + código (entra E cria
 * conta). "Entrar com senha" é o link terciário, e "Esqueci minha senha" só existe dentro dele. Só leitura, sem
 * enviar e-mail, a 390 e 1280 px. Código, reenvio e teto de tentativas: unitário codigo-acesso.test.ts e t203/t300.
 */
for (const [nome, largura, altura] of [
  ["390 px", 390, 844],
  ["1280 px", 1280, 800],
] as const) {
  test.describe(`T170 — entrada única (${nome})`, () => {
    test.use({ viewport: { width: largura, height: altura } });

    test("a entrada é o código; 'Entrar com senha' abre a senha e volta", async ({ page }) => {
      await page.goto("/auth");
      const tela = page.getByTestId("login-por-codigo");
      await expect(tela.getByRole("heading", { name: "Entre ou crie sua conta" })).toBeVisible();
      await expect(tela.getByRole("button", { name: "Continuar" })).toBeVisible();
      await expect(page.locator('input[type="password"]')).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Esqueci minha senha" })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      // Terciário: a senha (e o "Esqueci minha senha" dentro dela).
      await expect(async () => {
        await page.getByTestId("entrar-com-senha").click({ timeout: 4_000 });
        await expect(page.getByTestId("login-com-senha")).toBeVisible({ timeout: 3_000 });
      }).toPass({ timeout: 30_000 });
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.getByRole("button", { name: "Esqueci minha senha" })).toBeVisible();
      await page.getByRole("button", { name: /Entrar com código por e-mail/ }).click();
      await expect(page.getByTestId("login-por-codigo")).toBeVisible();
    });

    test("links antigos (?cadastro=1, ?codigo=1) caem na entrada única", async ({ page }) => {
      for (const url of ["/auth?cadastro=1", "/auth?codigo=1"]) {
        await page.goto(url);
        await expect(page.getByTestId("login-por-codigo")).toBeVisible();
        await expect(page.getByPlaceholder("Nome completo")).toHaveCount(0);
      }
    });
  });
}
