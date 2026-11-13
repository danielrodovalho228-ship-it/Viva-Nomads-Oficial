import { test, expect } from "@playwright/test";

/**
 * T217 — Home e /buscar no padrão 3 Ss (ordem 86dcb4db, B1/H2/H3/H1), pública, 390 e 1280 px.
 * B1: no máximo 2 selos sobre a foto do cartão; H2: destaques em número par (2x2 no celular, 4 no computador);
 * H3: 4 selos de confiança; H1: 4 passos, o 4º é "Conferência de entrada" (nunca "vistoria").
 */
for (const largura of [390, 1280]) {
  test.describe(`T217 — Home e busca (${largura} px)`, () => {
    test.use({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });

    // E626 (06/11): no máximo 2 pílulas sobre a foto (nível + símbolos) — nenhuma sobre o coração.
    test("/buscar: os selos de cada cartão ficam fora do coração", async ({ page }) => {
      await page.goto("/buscar", { waitUntil: "networkidle" });
      // Sem selo nenhum, a fileira não é desenhada (E416): sem nada a conferir, nada falha.
      const grupos = page.getByTestId("selos-foto");
      const n = await grupos.count();
      for (let i = 0; i < n; i++) {
        const sobre = await grupos.nth(i).evaluate((fila) => {
          const cor = fila.closest('[data-testid="cartao-imovel"]')?.querySelector('[data-testid="coracao"]')?.getBoundingClientRect();
          if (!cor) return 0;
          return [...fila.querySelectorAll("[data-selo], [data-nivel]")].filter((s) => {
            const r = s.getBoundingClientRect();
            return !(r.right <= cor.left || r.left >= cor.right || r.bottom <= cor.top || r.top >= cor.bottom);
          }).length;
        });
        expect(sobre).toBe(0);
        expect(Number(await grupos.nth(i).getAttribute("data-pilulas")), "no máximo 2 pílulas").toBeLessThanOrEqual(2);
      }
    });

    test("home: faixa de confiança com 4 selos, 4 passos e destaques em número par", async ({ page }) => {
      await page.goto("/", { waitUntil: "networkidle" });

      const faixa = page.getByTestId("faixa-confianca");
      await expect(faixa.locator(":scope > *")).toHaveCount(4);
      // E813: o selo da caução diz a base (CAUCAO_CURTA).
      for (const t of ["Perfil verificado", "Caução de 50% do valor mensal por bloco", "Documentação do imóvel conferida", "R$ 0 de taxa para o morador"]) {
        await expect(faixa).toContainText(t);
      }

      const passos = page.getByTestId("passos-home");
      await expect(passos.locator(":scope > *")).toHaveCount(4);
      await expect(passos).toContainText("Conferência de entrada");
      await expect(passos).not.toContainText(/vistoria/i);

      const destaques = page.getByTestId("destaques-home");
      if ((await destaques.count()) > 0) {
        const total = await destaques.locator(":scope > *").count();
        expect([2, 4]).toContain(total);
        // 2x2 no celular, 4 numa linha no computador (ordem 9a12d06e, #674)
        const colunas = await destaques.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
        expect(colunas).toBe(largura === 390 ? 2 : 4);
        expect(total % colunas).toBe(0);
      }

      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    });
  });
}
