import { test, expect } from "@playwright/test";

/**
 * T67 — ordem 314f764e (prints 02, 03, 04): busca no celular.
 *  1. Topo com busca por cidade/bairro/endereço e botão de filtros; total de imóveis.
 *  2. Painel de filtros (preço, quartos, aceita pets, home office) com
 *     "Mostrar N imóveis"; aplicar volta à lista já filtrada (e a URL guarda).
 *  3. Cards com foto, preço/mês, quartos/banheiros e bairro.
 * 360/390 px sem rolagem lateral.
 * E82-A: o topo é a mesma linha de pílulas em toda largura (sem bloco só do celular); "Mais filtros" abre a folha e
 * mostra "(N)" com filtros da folha ligados; o preço aparece como valor da pílula "Preço".
 */
test.describe("T67 — Busca no celular", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const largura of [360, 390]) {
    test(`${largura} px: topo com busca e filtros, sem rolagem lateral`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 844 });
      await page.goto("/buscar", { waitUntil: "networkidle" });
      const topo = page.getByTestId("linha-pilulas");
      await expect(topo).toBeVisible();
      await expect(topo.getByTestId("pilula-local")).toBeVisible();
      await expect(topo.getByTestId("pilula-mais")).toBeVisible();
      await expect(page.getByTestId("titulo-busca")).toContainText(/\d+ imóve(l|is)/);
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(sobra).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `tests/laboratorio/saida/t67-busca-${largura}.png` });
    });
  }

  test("390 px: painel de filtros conta antes de aplicar e volta à lista filtrada", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/buscar", { waitUntil: "networkidle" });
    const totalAntes = Number((await page.getByTestId("titulo-busca").innerText()).match(/\d+/)?.[0]);

    await page.getByTestId("pilula-mais").click();
    const painel = page.getByRole("dialog", { name: "Filtros" });
    await expect(painel).toBeVisible();
    for (const t of ["Quartos", "Estadia", "Aceita pets", "Para trabalhar de casa"]) await expect(painel).toContainText(t);
    // E105: Preço, Tipo e Nível moram só nas pílulas de cima (um lugar só).
    for (const t of ["Preço por mês", "Tipo de imóvel", "Nível a partir de"]) await expect(painel).not.toContainText(t);
    await expect(painel.getByTestId("aplicar-filtros")).toHaveText(`Mostrar ${totalAntes} ${totalAntes === 1 ? "imóvel" : "imóveis"}`);
    await painel.screenshot({ path: "tests/laboratorio/saida/t67-painel-390.png" });

    // Faceta sem imóvel fica desabilitada (contagem 0): sem imóvel com 2+ quartos nesta base, não há o que filtrar.
    const doisMais = painel.locator("fieldset", { hasText: "Quartos" }).getByRole("button", { name: "2+", exact: true });
    test.skip(await doisMais.isDisabled(), "Sem imóvel com 2+ quartos nesta base.");
    await doisMais.click();
    const rotulo = await painel.getByTestId("aplicar-filtros").innerText();
    const n = Number(rotulo.match(/\d+/)?.[0] ?? 0);
    expect(n).toBeLessThanOrEqual(totalAntes);
    await painel.getByTestId("aplicar-filtros").click();

    await expect(painel).toHaveCount(0);
    await expect(page.getByTestId("titulo-busca")).toContainText(`${n} ${n === 1 ? "imóvel" : "imóveis"}`);
    // E105: o preço não está mais nesta folha (só na pílula "Preço"); os quartos contam no "(N)" de "Mais filtros".
    await expect(page.getByTestId("pilula-preco")).toHaveAttribute("data-valor", "");
    await expect(page.getByTestId("pilula-mais")).toContainText("(1)");
    await expect(page).toHaveURL(/quartos=2/);
    await expect(page).not.toHaveURL(/preco=/);

    // Cards: foto, preço por mês, quartos/banheiros e bairro.
    const cartoes = page.locator('a[href^="/imoveis/"]');
    await expect(cartoes).toHaveCount(n);
    const primeiro = cartoes.first();
    await expect(primeiro.locator("img").first()).toBeVisible();
    await expect(primeiro).toContainText("/mês");
    await expect(primeiro).toContainText(/\d+ quartos?/);
    await expect(primeiro).toContainText(/\d+ banheiros?/);
    for (const q of await page.getByTestId("card-quartos").allInnerTexts()) expect(Number(q.match(/\d+/)?.[0])).toBeGreaterThanOrEqual(2);
    await page.screenshot({ path: "tests/laboratorio/saida/t67-lista-filtrada-390.png", fullPage: false });
  });

  test("390 px: Esc fecha o painel sem aplicar o rascunho", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/buscar", { waitUntil: "networkidle" });
    await page.getByTestId("pilula-mais").click();
    const painel = page.getByRole("dialog", { name: "Filtros" });
    // Qualquer faceta com imóvel serve para o rascunho (as de contagem 0 ficam desabilitadas).
    const faceta = painel.locator('button[data-testid^="faceta-"]:not([disabled])').first();
    await expect(faceta).toBeVisible();
    await faceta.click();
    await expect(faceta).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");
    await expect(painel).toHaveCount(0);
    await expect(page.getByTestId("pilula-mais")).not.toContainText("(");
    await expect(page.getByTestId("pilula-mais")).toHaveAttribute("aria-pressed", "false");
    await expect(page).toHaveURL(/\/buscar$/);
  });

  test("link com filtros (atalho da home) abre o celular já filtrado", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/buscar?pet=1", { waitUntil: "networkidle" });
    // E82-A: sem resumo de filtros no topo — "Mais filtros (1)" e o chip ligado na folha.
    await expect(page.getByTestId("pilula-mais")).toContainText("(1)");
    await page.getByTestId("pilula-mais").click();
    await expect(page.getByRole("dialog", { name: "Filtros" }).getByRole("button", { name: "Aceita pets", exact: true })).toHaveAttribute("aria-pressed", "true");
  });

  test("1280 px: a mesma linha de pílulas; Preço abre o painel com as faixas", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/buscar", { waitUntil: "networkidle" });
    // E82-A: sem bloco só do celular nem busca compacta no cabeçalho — a mesma linha em toda largura.
    await expect(page.getByTestId("linha-pilulas")).toBeVisible();
    await page.getByTestId("pilula-preco").click();
    const painel = page.getByTestId("painel-pilula-preco");
    await expect(painel).toBeVisible();
    await expect(painel.getByTestId("pilula-preco-5000")).toContainText("Até R$ 5.000");
  });
});
