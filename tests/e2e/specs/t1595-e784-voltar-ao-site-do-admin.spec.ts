import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { hasAccount } from "../fixtures/accounts";

/**
 * T1595 — GUARDA DO E784 (#3620, merge na main em 09/11): o "‹ Voltar ao site" do admin no celular leva à ÚLTIMA página pública
 * visitada (guardada em sessionStorage a cada troca de página pública) e, sem rastro (entrada direta no admin), à home "/".
 * Os três caminhos a 390 px, como a equipe (admin do laboratório): (1) vindo de um anúncio → o mesmo anúncio, com a query;
 * (2) vindo da home → "/"; (3) entrada direta → "/". O t404 já cobre só o terceiro. Só no laboratório.
 */
test.describe("T1595 — E784: Voltar ao site do admin acompanha o contexto (390px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
  test.use({ storageState: authFile("admin"), viewport: { width: 390, height: 844 } });

  test("(1) vindo de um anúncio volta ao mesmo anúncio, com a query", async ({ page }) => {
    await page.goto("/imoveis/ube-003?entrada=2026-12-01", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(500); // o rastro grava no efeito depois da hidratação
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("admin-voltar-site")).toHaveAttribute("href", "/imoveis/ube-003?entrada=2026-12-01", { timeout: 25_000 });
  });

  test("(2) vindo da home volta à home", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(500);
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("admin-voltar-site")).toHaveAttribute("href", "/", { timeout: 25_000 });
  });

  test("(3) entrada direta no admin (nada guardado) sai para a home", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("admin-voltar-site")).toHaveAttribute("href", "/", { timeout: 25_000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  // Achado de desenho (não é defeito): a navegação da equipe com "‹ Voltar ao site" é só do celular (`lg:hidden`, E73/E176: "No computador
  // nada muda — a barra lateral já está aberta"). A 1280 px o link some DE PROPÓSITO; o t404 já exige a nav oculta. Aqui fica registrado.
  test("(4) a 1280 px o link não existe (comportamento só-móvel, por desenho)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("admin-numeros")).toBeVisible({ timeout: 25_000 });
    await expect(page.getByTestId("admin-nav-celular")).toBeHidden();
    await expect(page.getByTestId("admin-voltar-site")).toBeHidden();
  });
});
