import { test, expect } from "@playwright/test";

/**
 * T225 — Candidatura em etapas (ordem eb4b11d8, Pacote Clareza UX5), 390 e 1280 px.
 * Anúncio de exemplo (ube-002): explica e leva aos imóveis reais, sem botão de candidatura (E694).
 */
for (const largura of [390, 1280]) {
  test.describe(`T225 — Candidatura em anúncio de exemplo (${largura} px)`, () => {
    test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: largura, height: 900 } });

    // E694 (resíduo): o anúncio de exemplo NÃO oferece "Pedir para morar": a coluna e a barra explicam e levam aos imóveis
    // reais. Os 3 passos de verdade (Revisar → Mensagem → Confirmar) são de anúncio real: t327 os percorre.
    test("o exemplo explica de cara, sem botão de candidatura e com saída para os imóveis reais", async ({ page }) => {
      await page.goto("/imoveis/ube-002", { waitUntil: "domcontentloaded" });
      const explicacao = page.getByTestId("exemplo-sem-acoes");
      const saida = largura >= 1024 ? explicacao.getByTestId("exemplo-ver-reais") : page.getByTestId("barra-fixa-imovel").getByTestId("barra-ver-reais");
      await expect(saida).toBeVisible({ timeout: 30_000 });
      await expect(saida).toHaveAttribute("href", "/buscar");
      await expect(page.getByRole("button", { name: "Pedir para morar", exact: true })).toHaveCount(0);
      await expect(page.getByTestId("solicitacao-passo")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: `test-results/t225-exemplo-${largura}.png` });
    });
  });
}
