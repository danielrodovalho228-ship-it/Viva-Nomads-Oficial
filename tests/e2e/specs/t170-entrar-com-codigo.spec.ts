import { test, expect } from "@playwright/test";

/**
 * T170 — ordem d250ea2f, item 4: "Entrar com código por e-mail" na tela de login (sem senha).
 * Só leitura e sem enviar e-mail: confere que a opção existe a 390 e 1280 px, abre o pedido de
 * código, valida o e-mail e volta para o login. Código, reenvio e teto de tentativas: unitário
 * src/lib/seguranca/codigo-acesso.test.ts.
 */
for (const [nome, largura, altura] of [
  ["390 px", 390, 844],
  ["1280 px", 1280, 800],
] as const) {
  test.describe(`T170 — entrar com código (${nome})`, () => {
    test.use({ viewport: { width: largura, height: altura } });

    test("a opção aparece, abre o pedido de código e volta ao login", async ({ page }) => {
      await page.goto("/auth");
      const opcao = page.getByTestId("entrar-com-codigo");
      await expect(opcao).toBeVisible();
      await opcao.click();
      const tela = page.getByTestId("login-por-codigo");
      await expect(tela.getByRole("heading", { name: "Entrar com código" })).toBeVisible();
      await expect(tela.getByRole("button", { name: "Enviar código" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await tela.getByRole("button", { name: /Voltar para entrar/ }).click();
      await expect(page.getByTestId("entrar-com-codigo")).toBeVisible();
    });
  });
}
