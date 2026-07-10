import { test, expect } from "@playwright/test";

/**
 * T7 — FLUXO PÚBLICO (anônimo) + robots.txt/sitemap corretos.
 */
test.describe("T7 — Fluxo público", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("/home carrega com hero e busca", async ({ page }) => {
    await page.goto("/home", { waitUntil: "networkidle" });
    await expect(page.locator("h1").first()).toBeVisible();
    // Há um campo de busca (input) ou CTA de busca no topo.
    const temBusca =
      (await page.locator('input[type="search"], input[placeholder*="idade" i], input[placeholder*="uscar" i]').count()) > 0 ||
      (await page.getByRole("link", { name: /buscar|explorar/i }).count()) > 0;
    expect(temBusca).toBeTruthy();
  });

  test("/buscar com filtro na URL mostra chip ativo e 'Limpar filtros'", async ({ page }) => {
    // `pronto=1` liga o filtro "Pronto para Morar" → vira chip removível ativo.
    await page.goto("/buscar?pronto=1&orcamento=3500", { waitUntil: "networkidle" });
    await expect(page.getByText(/Limpar filtros/i).first()).toBeVisible();
    await expect(page.getByText(/Pronto para Morar/i).first()).toBeVisible();
  });

  test("página de imóvel exibe preço e (quando houver) selo Pronto para Morar", async ({ page }) => {
    await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator("body")).toContainText(/R\$\s?\d/); // preço
  });

  test("robots.txt libera o público e bloqueia internas, sem 'Disallow: /' global", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const txt = await res.text();
    expect(txt).toMatch(/Disallow:\s*\/dashboard/);
    expect(txt).toMatch(/Disallow:\s*\/simulacao/);
    // NUNCA um bloqueio global do site inteiro.
    const linhasGlobais = txt
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^Disallow:\s*\/$/.test(l));
    expect(linhasGlobais, "robots.txt não pode ter 'Disallow: /' global").toHaveLength(0);
    expect(txt).toMatch(/Sitemap:\s*https?:\/\/\S+\/sitemap\.xml/i);
  });

  test("sitemap.xml acessível com URLs públicas", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("<urlset");
    expect(xml).toMatch(/<loc>https?:\/\/\S+\/buscar<\/loc>/);
  });
});
