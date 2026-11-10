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

  // DEFEITO CONFIRMADO (reprova do Daniel, 10/11, 1920 px): o "‹ Voltar ao site" do admin NÃO existe em desktop (a faixa `admin-nav-celular`
  // tem `lg:hidden`). A conclusão anterior desta spec ("só-móvel por desenho") foi revertida. A correção é da Pista B (PR #3702).
  // O lab reproduz o defeito (run 42776863792: a 1280 px a faixa e o link estavam ocultos), então `test.fail` justificado: fica verde
  // enquanto o defeito existe e AVISA (passa inesperadamente) quando o #3702 pousar — aí é só remover o `test.fail`.
  test("(4) a 1280 px o link existe e leva à home (defeito aberto até o #3702)", async ({ page }) => {
    test.fail(true, "E784: link ausente em desktop; correção no PR #3702 (Pista B). Remover test.fail quando o #3702 pousar.");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("admin-numeros")).toBeVisible({ timeout: 25_000 });
    await expect(page.getByTestId("admin-voltar-site")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId("admin-voltar-site")).toHaveAttribute("href", "/");
  });
});
