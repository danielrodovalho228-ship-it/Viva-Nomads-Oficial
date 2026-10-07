import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T3 — ISOLAMENTO DE PAPÉIS E PÁGINAS INTERNAS (@criticos).
 * Não-admin não vê nem alcança área de admin; páginas internas (deck dos sócios)
 * ficam atrás do código dos sócios (porta única, SEM exceção para admin) +
 * noindex. Menu do proprietário = exatamente 10 itens, na ordem, cada um
 * abrindo DENTRO da casca.
 */

const OWNER_MENU = [
  "Visão geral",
  "Meus imóveis",
  "Interessados",
  "Pedidos de moradia",
  "Mensagens",
  "Fechamento",
  "Contratos & blocos",
  "Ferramentas",
  "Assinatura",
  "Conta",
];

const PAGINAS_INTERNAS = ["/simulacao", "/roi", "/socios", "/decisao", "/modelodenegocio"];

test.describe("T3 — Não-admin (proprietário) @criticos", () => {
  test.use({ storageState: authFile("proprietario") });

  test("itens Admin/Moderar ausentes do DOM e rota /admin bloqueada", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await expect(page.locator("aside nav")).not.toContainText(/Admin|Moderar/);
    await page.goto("/admin", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/dashboard(?!\/)/); // redirecionado para a Visão geral
  });

  test("páginas internas pedem o código dos sócios (redirect)", async ({ page }) => {
    for (const rota of PAGINAS_INTERNAS) {
      await page.goto(rota, { waitUntil: "networkidle" });
      await expect(page, `esperava redirect fora de ${rota}`).not.toHaveURL(new RegExp(`${rota}$`));
      const url = new URL(page.url());
      expect(url.pathname).toBe("/acesso-socios");
      expect(url.searchParams.get("next")).toBe(rota);
    }
  });

  test("menu do proprietário: exatamente 10 itens, na ordem", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    // Garante modo Proprietário.
    const tab = page.getByRole("tab", { name: /Propriet/i });
    if (await tab.isVisible()) await tab.click();
    const labels = (await page.locator("aside nav a").allInnerTexts()).map((t) => t.trim());
    expect(labels).toEqual(OWNER_MENU);
  });

  test("cada item do menu abre dentro da casca (sidebar presente)", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    const hrefs = await page.locator("aside nav a").evaluateAll((as) =>
      as.map((a) => (a as HTMLAnchorElement).getAttribute("href")!).filter(Boolean)
    );
    for (const href of hrefs) {
      await page.goto(href, { waitUntil: "networkidle" });
      await expect(page.locator("aside nav"), `casca ausente em ${href}`).toBeVisible();
    }
  });
});

test.describe("T3 — Internas: só com o código, e noindex @criticos", () => {
  test.use({ storageState: authFile("admin") });

  test("admin sem o código também é barrado (porta única)", async ({ page }) => {
    await page.goto("/simulacao", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/acesso-socios\?next=%2Fsimulacao/);
  });

  test("com o código dos sócios, as internas abrem e são noindex", async ({ page }) => {
    const codigo = process.env.SOCIOS_ACCESS_CODE;
    test.skip(!codigo, "SOCIOS_ACCESS_CODE não definido neste ambiente");
    await page.goto("/acesso-socios?next=%2Fsocios", { waitUntil: "networkidle" });
    await page.locator('input[name="codigo"]').fill(codigo!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/socios$/);
    for (const rota of PAGINAS_INTERNAS) {
      const resp = await page.goto(rota, { waitUntil: "networkidle" });
      await expect(page, `com o código deveria abrir ${rota}`).toHaveURL(new RegExp(`${rota}$`));
      // noindex vem do metadata da página e/ou do header X-Robots-Tag (proxy).
      const meta = await page.locator('meta[name="robots"]').getAttribute("content").catch(() => null);
      const header = resp?.headers()["x-robots-tag"] ?? "";
      expect(`${meta ?? ""} ${header}`.toLowerCase(), `noindex ausente em ${rota}`).toContain("noindex");
    }
  });
});
