import { test, expect } from "@playwright/test";

/**
 * T198 — ordem fe07f85d item 4 (continuação, achado do Moacir no #811):
 * os campos de nome e e-mail do chamado (/ajuda) e do "Falar com uma pessoa"
 * da Viva só aparecem depois de um clique, então o HTML de produção não os
 * prova. Deslogado, a 390 e 1280 px: name e autocomplete corretos para o
 * navegador preencher sozinho.
 */
for (const largura of [390, 1280]) {
  test.describe(`${largura} px`, () => {
    test.use({ viewport: { width: largura, height: 844 } });

    test("/ajuda: chamado tem nome (name/autocomplete) e e-mail (email/email)", async ({ page }) => {
      await page.goto("/ajuda?novo=1", { waitUntil: "networkidle" });
      const nome = page.getByLabel("Seu nome");
      const email = page.getByLabel(/Seu e-mail/);
      await expect(nome).toBeVisible();
      await expect(nome).toHaveAttribute("name", "nome");
      await expect(nome).toHaveAttribute("autocomplete", "name");
      await expect(email).toBeVisible();
      await expect(email).toHaveAttribute("name", "email");
      await expect(email).toHaveAttribute("type", "email");
      await expect(email).toHaveAttribute("autocomplete", "email");
    });

    test("chat da Viva: 'Falar com uma pessoa' tem nome e e-mail com autocomplete", async ({ page }) => {
      await page.goto("/ajuda", { waitUntil: "networkidle" });
      const bloco = page.getByTestId("viva-chat-bloco");
      await bloco.getByRole("button", { name: /Falar com uma pessoa/i }).click();
      const form = page.getByTestId("form-pessoa");
      await expect(form).toBeVisible();
      const nome = form.getByLabel("Seu nome");
      const email = form.getByLabel("Seu e-mail");
      await expect(nome).toHaveAttribute("name", "nome");
      await expect(nome).toHaveAttribute("autocomplete", "name");
      await expect(email).toHaveAttribute("name", "email");
      await expect(email).toHaveAttribute("type", "email");
      await expect(email).toHaveAttribute("autocomplete", "email");
    });
  });
}
