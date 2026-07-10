import { test, expect } from "@playwright/test";

/**
 * T1 — AUTENTICAÇÃO E GUARDS (proxy do Next.js 16).
 * Anônimo em rota privada é mandado para /auth guardando o destino (?redirect=).
 *
 * Nota de realidade: /pedidos/novo é DELIBERADAMENTE público (o inquilino vê o
 * formulário sem logar; só PUBLICAR exige sessão — o T5 cobre isso). Portanto o
 * guard é verificado em /dashboard e /pedidos (lista), não em /pedidos/novo.
 */
test.describe("T1 — Autenticação e guards", () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // anônimo

  test("anônimo em /dashboard → redirect para /auth com destino", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth/);
    expect(new URL(page.url()).searchParams.get("redirect")).toBe("/dashboard");
  });

  test("anônimo em /pedidos (mural) → redirect para /auth", async ({ page }) => {
    await page.goto("/pedidos");
    await expect(page).toHaveURL(/\/auth/);
  });

  test("/pedidos/novo é público (formulário visível sem login)", async ({ page }) => {
    await page.goto("/pedidos/novo");
    await expect(page).toHaveURL(/\/pedidos\/novo/);
    await expect(page.getByRole("button", { name: /Publicar pedido/i })).toBeVisible();
  });

  test("/auth mostra o formulário de login", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.locator('input[name="email"], input[type="email"]').first()).toBeVisible();
    // "Entrar" do form (há outro no alternador login/cadastro fora do form).
    await expect(page.locator("form").getByRole("button", { name: /^entrar$/i })).toBeVisible();
  });
});
