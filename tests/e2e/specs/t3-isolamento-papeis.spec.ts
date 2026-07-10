import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T3 — ISOLAMENTO DE PAPÉIS E PÁGINAS INTERNAS (@criticos).
 * Não-admin não vê nem alcança área de admin; páginas internas (deck dos sócios)
 * são gated no proxy (redirect) + noindex. Menu do proprietário = exatamente 9
 * itens, na ordem, cada um abrindo DENTRO da casca.
 */

const OWNER_MENU = [
  "Visão geral",
  "Meus imóveis",
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

  test("páginas internas bloqueadas para não-admin (redirect)", async ({ page }) => {
    for (const rota of PAGINAS_INTERNAS) {
      await page.goto(rota, { waitUntil: "networkidle" });
      await expect(page, `esperava redirect fora de ${rota}`).not.toHaveURL(new RegExp(`${rota}$`));
      await expect(page).toHaveURL(/\/dashboard|\/auth/);
    }
  });

  test("menu do proprietário: exatamente 9 itens, na ordem", async ({ page }) => {
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

test.describe("T3 — Admin vê internas com noindex @criticos", () => {
  test.use({ storageState: authFile("admin") });

  test("páginas internas carregam para admin e são noindex", async ({ page }) => {
    for (const rota of PAGINAS_INTERNAS) {
      const resp = await page.goto(rota, { waitUntil: "networkidle" });
      await expect(page, `admin deveria acessar ${rota}`).toHaveURL(new RegExp(`${rota}$`));
      // noindex vem do metadata da página e/ou do header X-Robots-Tag (proxy).
      const meta = await page.locator('meta[name="robots"]').getAttribute("content").catch(() => null);
      const header = resp?.headers()["x-robots-tag"] ?? "";
      expect(`${meta ?? ""} ${header}`.toLowerCase(), `noindex ausente em ${rota}`).toContain("noindex");
    }
  });
});
