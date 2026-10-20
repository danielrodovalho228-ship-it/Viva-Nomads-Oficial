import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, liberarLimiteLoginIp } from "../fixtures/laboratorio";

/**
 * F43/F44 — login sem enumeração de e-mail e com atraso depois de 3 falhas.
 * A rota de login do servidor é simulada (401 credenciais) para qualquer e-mail:
 * a tela tem que reagir IGUAL com conta ou sem conta.
 */
test.describe("Login — sem enumeração e com atraso (F43/F44)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("falha mostra sempre a mesma mensagem, links fixos e nenhuma consulta de e-mail", async ({ page }) => {
    const consultas: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("email-existe")) consultas.push(r.url());
    });
    await page.route("**/api/auth/entrar", (r) =>
      r.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ ok: false, codigo: "credenciais" }) })
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
    await page.route("**/api/auth/entrar", (r) =>
      r.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ ok: false, codigo: "credenciais" }) })
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

  test("servidor: a 6ª tentativa seguida do mesmo e-mail leva 429 com Retry-After (chamando a rota direto)", async ({ request }) => {
    // O lab inteiro sai do mesmo IP: sem zerar o contador por IP, o "outro e-mail" abaixo leva 429.
    if (NO_LABORATORIO) await liberarLimiteLoginIp();
    const email = `atraso-${Date.now()}@exemplo.com.br`;
    let ultimo = 0;
    let retry: string | undefined;
    for (let i = 0; i < 6; i++) {
      const r = await request.post("/api/auth/entrar", { data: { email, password: "senha-errada-123" } });
      ultimo = r.status();
      retry = r.headers()["retry-after"];
    }
    expect(ultimo).toBe(429);
    expect(Number(retry)).toBeGreaterThan(0);
    // outro e-mail não é afetado
    if (NO_LABORATORIO) await liberarLimiteLoginIp();
    const outro = await request.post("/api/auth/entrar", { data: { email: `outro-${Date.now()}@exemplo.com.br`, password: "x" } });
    expect(outro.status()).toBe(401);
  });
});
