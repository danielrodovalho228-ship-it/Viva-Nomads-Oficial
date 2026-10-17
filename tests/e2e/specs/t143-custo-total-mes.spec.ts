import { test, expect } from "@playwright/test";

/**
 * T143 — Custo total do mês (ordem 1a555bfa): o MESMO número na coluna de reserva,
 * no cartão da busca e na barra fixa do celular, em ube-001 e ube-005 (390 e 1280 px).
 * Pagamentos únicos ficam fora do total; IPTU avisado; sem "aluguel"/"comissão".
 */
const num = (t: string) => Number((t.match(/R\$\s?([\d.]+)(?:,\d+)?/)?.[1] ?? "").replace(/\./g, ""));

for (const id of ["ube-001", "ube-005"]) {
  test.describe(`T143 — ${id}`, () => {
    test("1280 px: total por mês na coluna, único fora do total, IPTU avisado", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`/imoveis/${id}`, { waitUntil: "networkidle" });
      const card = page.locator("#cartao-preco");
      await expect(card.getByText("Quanto você paga por mês")).toBeVisible();
      const total = num((await card.getByTestId("total-por-mes").innerText()));
      expect(total).toBeGreaterThan(0);
      await expect(card.getByTestId("iptu-nota")).toContainText("IPTU não incluso");
      await expect(card.locator('[data-taxa="caucao"]')).toContainText("conferência de saída");
      // únicos não estão dentro da lista do total
      await expect(card.getByTestId("total-mensal").locator('[data-taxa="preparacao"], [data-taxa="saida"]')).toHaveCount(0);
      const txt = await card.innerText();
      expect(txt).not.toMatch(/aluguel|comiss/i);
    });

    test("390 px: barra fixa mostra o mesmo total e leva ao detalhamento", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/imoveis/${id}`, { waitUntil: "networkidle" });
      const totalPagina = num(await page.locator("#cartao-preco").getByTestId("total-por-mes").innerText());
      const barra = page.getByTestId("barra-fixa-imovel");
      await expect(barra).toBeVisible();
      expect(num(await barra.getByTestId("barra-total").innerText())).toBe(totalPagina);
      await expect(barra.getByTestId("barra-total")).toContainText("/mês total");
      await barra.getByTestId("barra-total").click();
      await expect(page).toHaveURL(/#cartao-preco$/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });

    test("cartão da busca mostra o mesmo total", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/imoveis/${id}`, { waitUntil: "networkidle" });
      const totalPagina = num(await page.locator("#cartao-preco").getByTestId("total-por-mes").innerText());
      await page.goto("/buscar", { waitUntil: "networkidle" });
      const cartao = page.locator(`a[href="/imoveis/${id}"]`).first();
      await expect(cartao.getByTestId("cartao-total-mes")).toContainText("/mês total");
      expect(num(await cartao.getByTestId("cartao-total-mes").innerText())).toBe(totalPagina);
    });
  });
}
