import { test, expect } from "@playwright/test";

/**
 * T132 — Anúncio de exemplo não oferece "Pedir para morar" (E694, resíduo; antes: o "Solicitar" nunca ficava mudo).
 * No exemplo (ube-001) a coluna de reserva e a barra do celular trazem a explicação e a saída para os imóveis reais; o
 * fluxo de candidatura de verdade (resumo, datas) é de anúncio real: t327, t357 e t855 o percorrem.
 */
for (const [nome, largura, altura] of [["1280", 1280, 900], ["390", 390, 844]] as const) {
  test.describe(`T132 — ${nome} px`, () => {
    test("o exemplo explica e leva aos imóveis reais; não há botão que peça para morar", async ({ page }) => {
      await page.setViewportSize({ width: largura, height: altura });
      await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
      const card = page.locator("#cartao-preco");
      await expect(card.getByTestId("exemplo-sem-acoes")).toContainText(/anúncio é de exemplo/i);
      await expect(page.getByRole("button", { name: "Pedir para morar", exact: true })).toHaveCount(0);
      const saida = largura >= 1024 ? card.getByTestId("exemplo-ver-reais") : page.getByTestId("barra-fixa-imovel").getByTestId("barra-ver-reais");
      await expect(saida).toHaveAttribute("href", "/buscar");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  });
}
