import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T3 — ISOLAMENTO DE PAPÉIS E PÁGINAS INTERNAS (@criticos).
 * Não-admin não vê nem alcança área de admin; páginas internas (deck dos sócios)
 * ficam atrás do código dos sócios (porta única, SEM exceção para admin) +
 * noindex. Menu do proprietário (cascata, conta única — ordem 9f3085d8): os grupos
 * na ordem, e cada item, com todos os grupos abertos, abrindo DENTRO da casca.
 */

const OWNER_MENU = [
  "Visão geral",
  "Minha moradia",
  "Mensagens",
  "Meus imóveis",
  "Contratos e garantias",
  "Ferramentas",
  "Minha conta",
];

/** Abre todos os grupos do menu em cascata (inclusive subgrupos). */
async function abrirTudo(page: import("@playwright/test").Page) {
  const fechados = page.locator('aside nav button[aria-expanded="false"]');
  for (let i = 0; i < 20 && (await fechados.count()) > 0; i++) await fechados.first().click();
}

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

  test("menu do proprietário: grupos da cascata, na ordem", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    const grupos = page.locator('aside nav [data-testid="menu-cascata"] > li > :is(a, button)');
    await expect.poll(async () => (await grupos.allInnerTexts()).map((t) => t.trim())).toEqual(OWNER_MENU);
  });

  test("cada item do menu abre dentro da casca (sidebar presente)", async ({ page }) => {
    test.setTimeout(240_000); // ~25 telas no menu em cascata
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await abrirTudo(page);
    const hrefs = await page.locator("aside nav a").evaluateAll((as) =>
      as.map((a) => (a as HTMLAnchorElement).getAttribute("href")!).filter(Boolean)
    );
    expect(hrefs.length).toBeGreaterThan(15);
    // A busca é a página pública (fora da casca, de propósito); âncoras viram a própria tela.
    for (const href of [...new Set(hrefs.map((h) => h.split("#")[0]))].filter((h) => h !== "/buscar")) {
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
