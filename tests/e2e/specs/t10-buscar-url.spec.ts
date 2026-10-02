import { test, expect } from "@playwright/test";

/**
 * T10 — BUSCA COMPARTILHÁVEL (G1) @criticos
 *
 * Regressão do fix G1: os filtros da /buscar vivem na URL (query params), então
 * a busca é compartilhável/salvável e sobrevive a reload. Cobre os dois sentidos:
 *   (escrita)  aplicar filtro na UI  → aparece no endereço
 *   (leitura)  abrir URL com filtro  → chip ativo + filtro aplicado
 *   (ida-volta) copiar a URL e abrir noutra aba → mesma busca
 *
 * Público/anônimo — não depende de conta nem de seed.
 */
test.describe("T10 — Busca compartilhável (URL) @criticos", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("aplicar filtro na UI reflete na URL (pronto=1)", async ({ page }) => {
    await page.goto("/buscar", { waitUntil: "networkidle" });
    // Sem filtro, a URL não traz `pronto`.
    expect(page.url()).not.toMatch(/pronto=1/);

    await page.getByRole("button", { name: /Pronto para Morar/i }).first().click();

    // O efeito de sync usa replaceState — espera o endereço refletir o filtro.
    await expect(async () => {
      expect(page.url()).toMatch(/pronto=1/);
    }).toPass({ timeout: 5_000 });

    // E vira chip ativo removível + "Limpar filtros".
    await expect(page.getByText(/Limpar filtros/i).first()).toBeVisible();
  });

  test("abrir URL com filtro aplica e mostra chip ativo", async ({ page }) => {
    await page.goto("/buscar?pronto=1&preco=3500", { waitUntil: "networkidle" });
    await expect(page.getByText(/Limpar filtros/i).first()).toBeVisible();
    await expect(page.getByText(/Pronto para Morar/i).first()).toBeVisible();
    // O parâmetro do preço continua na URL (não foi apagado pelo sync no mount).
    expect(page.url()).toMatch(/preco=3500/);
  });

  test("ida-volta: URL gerada pela UI reproduz a mesma busca noutra aba", async ({
    page,
    context,
  }) => {
    await page.goto("/buscar", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Pronto para Morar/i }).first().click();
    await expect(async () => {
      expect(page.url()).toMatch(/pronto=1/);
    }).toPass({ timeout: 5_000 });

    const shared = page.url();
    const outra = await context.newPage();
    await outra.goto(shared, { waitUntil: "networkidle" });
    await expect(outra.getByText(/Pronto para Morar/i).first()).toBeVisible();
    await expect(outra.getByText(/Limpar filtros/i).first()).toBeVisible();
    await outra.close();
  });
});
