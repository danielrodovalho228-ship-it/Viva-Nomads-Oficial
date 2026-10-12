import { test, expect } from "@playwright/test";

/**
 * F43/F44 — login sem enumeração de e-mail e com atraso depois de 3 falhas.
 * O Supabase Auth é simulado (400 invalid_credentials) para qualquer e-mail:
 * a tela tem que reagir IGUAL com conta ou sem conta.
 */
test.describe("Login — sem enumeração e com atraso (F43/F44)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("falha mostra sempre a mesma mensagem, links fixos e nenhuma consulta de e-mail", async ({ page }) => {
    const consultas: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("email-existe")) consultas.push(r.url());
    });
    await page.route("**/auth/v1/token*", (r) =>
      r.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "invalid_credentials", message: "Invalid login credentials" }) })
    );
    await page.goto("/auth");
    await page.locator('input[type="email"]').first().fill("ninguem@exemplo.com.br");
    await page.locator('input[type="password"]').first().fill("senha-errada-123");
    await page.locator("form").getByRole("button", { name: /^entrar$/i }).click();
    await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
    await expect(page.getByText(/Ainda não há conta/i)).toHaveCount(0);
    const links = page.getByTestId("login-links-fixos");
    await expect(links.getByRole("button", { name: "Criar conta" })).toBeVisible();
    await expect(links.getByRole("button", { name: "Esqueci minha senha" })).toBeVisible();
    expect(consultas).toEqual([]);
  });

  test("depois de 3 falhas o botão espera (atraso progressivo)", async ({ page }) => {
    await page.route("**/auth/v1/token*", (r) =>
      r.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "invalid_credentials", message: "Invalid login credentials" }) })
    );
    await page.goto("/auth");
    await page.locator('input[type="email"]').first().fill("outro@exemplo.com.br");
    await page.locator('input[type="password"]').first().fill("senha-errada-123");
    const entrar = page.locator("form").getByRole("button", { name: /^entrar$/i });
    for (let i = 0; i < 3; i++) {
      await entrar.click();
      await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
    }
    await expect(page.getByTestId("login-aviso-tentativas")).toBeVisible();
    await expect(entrar).toBeDisabled();
  });
});
