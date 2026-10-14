import { test, expect } from "@playwright/test";

/**
 * T67 — ordem 314f764e (prints 02, 03, 04): busca no celular.
 *  1. Topo com busca por cidade/bairro/endereço e botão de filtros; total de imóveis.
 *  2. Painel de filtros (preço, quartos, aceita pets, home office) com
 *     "Mostrar N imóveis"; aplicar volta à lista já filtrada (e a URL guarda).
 *  3. Cards com foto, preço/mês, quartos/banheiros e bairro.
 * 360/390 px sem rolagem lateral; no computador os filtros antigos seguem iguais.
 */
test.describe("T67 — Busca no celular", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const largura of [360, 390]) {
    test(`${largura} px: topo com busca e filtros, sem rolagem lateral`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 844 });
      await page.goto("/buscar", { waitUntil: "networkidle" });
      const topo = page.getByTestId("busca-celular");
      await expect(topo).toBeVisible();
      await expect(topo.getByRole("button", { name: /^Filtros/ })).toBeVisible();
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

    await page.getByTestId("abrir-filtros").click();
    const painel = page.getByRole("dialog", { name: "Filtros" });
    await expect(painel).toBeVisible();
    for (const t of ["Preço por mês", "Quartos", "Aceita pets", "Para trabalhar de casa"]) await expect(painel).toContainText(t);
    await expect(painel.getByTestId("aplicar-filtros")).toHaveText(`Mostrar ${totalAntes} ${totalAntes === 1 ? "imóvel" : "imóveis"}`);
    await painel.screenshot({ path: "tests/laboratorio/saida/t67-painel-390.png" });

    await painel.locator("fieldset", { hasText: "Quartos" }).getByText("2+", { exact: true }).click();
    await painel.locator("fieldset", { hasText: "Preço por mês" }).getByText("Até R$ 5.000", { exact: true }).click();
    const rotulo = await painel.getByTestId("aplicar-filtros").innerText();
    const n = Number(rotulo.match(/\d+/)?.[0] ?? 0);
    test.skip(n === 0, "Sem imóvel com 2+ quartos até R$ 5.000 nesta base.");
    expect(n).toBeLessThanOrEqual(totalAntes);
    await painel.getByTestId("aplicar-filtros").click();

    await expect(painel).toHaveCount(0);
    await expect(page.getByTestId("titulo-busca")).toContainText(`${n} ${n === 1 ? "imóvel" : "imóveis"}`);
    await expect(page.getByTestId("abrir-filtros")).toHaveAccessibleName("Filtros (2 ativos)");
    await expect(page.getByTestId("resumo-filtros")).toHaveText("Até R$ 5.000 · 2+ quartos");
    await expect(page).toHaveURL(/quartos=2/);
    await expect(page).toHaveURL(/preco=5000/);

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
    await page.getByTestId("abrir-filtros").click();
    const painel = page.getByRole("dialog", { name: "Filtros" });
    await painel.getByText("Aceita pets", { exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(painel).toHaveCount(0);
    await expect(page.getByTestId("abrir-filtros")).toHaveAccessibleName("Filtros");
    await expect(page).not.toHaveURL(/pet=1/);
  });

  test("link com filtros (atalho da home) abre o celular já filtrado", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/buscar?pet=1", { waitUntil: "networkidle" });
    await expect(page.getByTestId("resumo-filtros")).toHaveText("Aceita pets");
    await expect(page.getByTestId("abrir-filtros")).toHaveAccessibleName("Filtros (1 ativos)");
  });

  test("1280 px: topo do celular escondido; filtros do computador visíveis", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/buscar", { waitUntil: "networkidle" });
    await expect(page.getByTestId("busca-celular")).toBeHidden();
    // Ordem eac7e3a1: no computador os filtros abrem pela busca compacta do cabeçalho.
    await page.getByTestId("busca-compacta").click();
    await expect(page.getByRole("combobox", { name: "Preço máximo" })).toBeVisible();
  });
});
