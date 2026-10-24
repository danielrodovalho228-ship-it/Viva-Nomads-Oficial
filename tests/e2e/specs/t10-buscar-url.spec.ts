import { test, expect, type Page } from "@playwright/test";

/**
 * FILTROS-1 (E43): "Pronto para Morar" mora só na folha de filtros (saiu da barra de cima). Liga o filtro pela folha:
 * celular pelo botão "Filtros"; computador por "Mais filtros" (que pode estar atrás da busca compacta). Aplica e espera
 * a folha fechar.
 */
async function ligarProntoPelaFolha(page: Page) {
  const celular = page.getByTestId("abrir-filtros").filter({ visible: true });
  if (await celular.count()) await celular.first().click({ timeout: 10_000 });
  else {
    if (!(await page.getByTestId("mais-filtros").isVisible())) await page.getByTestId("busca-compacta").click({ timeout: 10_000 });
    await page.getByTestId("mais-filtros").click({ timeout: 10_000 });
  }
  const folha = page.getByTestId("painel-filtros");
  await expect(folha).toBeVisible({ timeout: 10_000 });
  await folha.getByTestId("faceta-pronto").click({ timeout: 10_000 });
  await folha.getByTestId("aplicar-filtros").click({ timeout: 10_000 });
  await expect(folha).toBeHidden({ timeout: 10_000 });
}

/**
 * L-43 (vigia, 24/10): o painel e a /buscar não assentam em "networkidle" (t183, L-40); espera até 10 s e segue para o elemento.
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
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    // Sem filtro, a URL não traz `pronto`.
    expect(page.url()).not.toMatch(/pronto=1/);

    await ligarProntoPelaFolha(page);

    // O efeito de sync usa replaceState — espera o endereço refletir o filtro.
    await expect(async () => {
      expect(page.url()).toMatch(/pronto=1/);
    }).toPass({ timeout: 5_000 });

    // E vira chip ativo removível + "Limpar filtros".
    await expect(page.getByText(/Limpar filtros/i).filter({ visible: true }).first()).toBeVisible();
  });

  test("abrir URL com filtro aplica e mostra chip ativo", async ({ page }) => {
    await page.goto("/buscar?pronto=1&preco=3500", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await expect(page.getByText(/Limpar filtros/i).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(/Pronto para Morar/i).filter({ visible: true }).first()).toBeVisible();
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
    await expect(outra.getByText(/Pronto para Morar/i).filter({ visible: true }).first()).toBeVisible();
    await expect(outra.getByText(/Limpar filtros/i).filter({ visible: true }).first()).toBeVisible();
    await outra.close();
  });
});

/**
 * F3 (QA 12/10): o botão flutuante "Fale com a Viva" nunca cobre os filtros.
 * Celular (ordem 314f764e): o botão "Filtros" do topo abre o painel. Computador: "Mais filtros".
 * Ordem 4f8d17c6: o flutuante agora aparece também na /buscar (mesmo formato do site).
 */
for (const largura of [360, 390]) {
  test(`F3 — "Filtros" clicável em ${largura}px, com o botão flutuante da Viva visível`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: largura, height: 800 } });
    const page = await ctx.newPage();
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await expect(page.getByTestId("fale-com-a-viva")).toBeVisible();
    await page.getByTestId("abrir-filtros").click();
    await expect(page.getByRole("dialog", { name: "Filtros" })).toBeVisible();
    await ctx.close();
  });
}
test(`F3 — "Mais filtros" clicável em 1280px, com o botão flutuante da Viva visível`, async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto("/buscar", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await expect(page.getByTestId("fale-com-a-viva")).toBeVisible();
  await page.getByTestId("busca-compacta").click(); // ordem eac7e3a1: filtros abrem pelo cabeçalho
  await page.getByRole("button", { name: /Mais filtros/i }).click();
  // Prompt 40: "Mais filtros" abre a folha de filtros na lateral.
  await expect(page.getByRole("dialog", { name: "Filtros" })).toBeVisible();
  await ctx.close();
});
