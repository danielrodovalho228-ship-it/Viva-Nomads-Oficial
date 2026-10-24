import { test, expect, type Page } from "@playwright/test";

/**
 * FILTROS-1 (E43): "Pronto para Morar" mora só na folha de filtros. E82-A: a folha abre pela pílula "Mais filtros" da
 * linha única (a mesma em toda largura). Aplica e espera a folha fechar.
 */
async function abrirFolha(page: Page) {
  await page.getByTestId("pilula-mais").click({ timeout: 10_000 });
  const folha = page.getByTestId("painel-filtros");
  await expect(folha).toBeVisible({ timeout: 10_000 });
  return folha;
}

async function ligarProntoPelaFolha(page: Page) {
  const folha = await abrirFolha(page);
  await folha.getByTestId("faceta-pronto").click({ timeout: 10_000 });
  await folha.getByTestId("aplicar-filtros").click({ timeout: 10_000 });
  await expect(folha).toBeHidden({ timeout: 10_000 });
}

/** E82-A: sem chips de filtro ativo na página — o filtro ligado aparece marcado (aria-pressed) na folha. */
async function esperarProntoLigadoNaFolha(page: Page) {
  const folha = await abrirFolha(page);
  await expect(folha.getByTestId("faceta-pronto")).toHaveAttribute("aria-pressed", "true");
}

/**
 * L-43 (vigia, 24/10): o painel e a /buscar não assentam em "networkidle" (t183, L-40); espera até 10 s e segue para o elemento.
 * T10 — BUSCA COMPARTILHÁVEL (G1) @criticos
 *
 * Regressão do fix G1: os filtros da /buscar vivem na URL (query params), então
 * a busca é compartilhável/salvável e sobrevive a reload. Cobre os dois sentidos:
 *   (escrita)  aplicar filtro na UI  → aparece no endereço
 *   (leitura)  abrir URL com filtro  → pílula ativa / faceta marcada + filtro aplicado
 *   (ida-volta) copiar a URL e abrir noutra aba → mesma busca
 *
 * Público/anônimo — não depende de conta nem de seed.
 */
test.describe("T10 — Busca compartilhável (URL) @criticos", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("aplicar filtro na UI reflete na URL (pronto=1)", async ({ page }) => {
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    // Sem filtro, a URL não traz `pronto`.
    expect(page.url()).not.toMatch(/pronto=1/);

    await ligarProntoPelaFolha(page);

    // O efeito de sync usa replaceState — espera o endereço refletir o filtro.
    await expect(async () => {
      expect(page.url()).toMatch(/pronto=1/);
    }).toPass({ timeout: 5_000 });

    // E82-A: sem chips nem "Limpar filtros" na página — o filtro fica marcado na folha.
    await esperarProntoLigadoNaFolha(page);
  });

  test("abrir URL com filtro aplica e mostra chip ativo", async ({ page }) => {
    await page.goto("/buscar?pronto=1&preco=3500", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    // E82-A: o preço aparece como valor da pílula "Preço"; "Pronto para Morar", marcado na folha.
    await expect(page.getByTestId("pilula-preco")).toHaveAttribute("data-valor", "Até R$ 3.500");
    await esperarProntoLigadoNaFolha(page);
    // O parâmetro do preço continua na URL (não foi apagado pelo sync no mount).
    expect(page.url()).toMatch(/preco=3500/);
  });

  test("ida-volta: URL gerada pela UI reproduz a mesma busca noutra aba", async ({
    page,
    context,
  }) => {
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await ligarProntoPelaFolha(page);
    await expect(async () => {
      expect(page.url()).toMatch(/pronto=1/);
    }).toPass({ timeout: 5_000 });

    const shared = page.url();
    const outra = await context.newPage();
    await outra.goto(shared, { waitUntil: "domcontentloaded" });
    await outra.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await esperarProntoLigadoNaFolha(outra);
    await outra.close();
  });
});

/**
 * F3 (QA 12/10): nada cobre os filtros. E82-A + E95: a mesma pílula "Mais filtros" em toda largura abre a folha, e o
 * botão flutuante "Fale com a Viva" não aparece na /buscar (cobria "Mais filtros").
 */
for (const largura of [360, 390, 1280]) {
  test(`F3 — "Mais filtros" clicável em ${largura}px, sem o botão flutuante da Viva`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: largura, height: 800 } });
    const page = await ctx.newPage();
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await expect(page.getByTestId("pilula-mais")).toBeVisible();
    await expect(page.getByTestId("fale-com-a-viva")).toBeHidden();
    await page.getByTestId("pilula-mais").click();
    // Prompt 40: "Mais filtros" abre a folha de filtros.
    await expect(page.getByRole("dialog", { name: "Filtros" })).toBeVisible();
    await ctx.close();
  });
}
