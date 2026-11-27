import { test, expect } from "@playwright/test";

/**
 * T1590 — GUARDA DO E729 (#3503, merge na main em 09/11): no formulário "Seja parceiro" (/parceiros), a exigência de cada
 * categoria aparece JUNTO do cartão da categoria, ANTES de marcar — Fotografia "Pede o link do portfólio" e Mudança
 * "Pede empresa e veículo" —, e só essas duas categorias trazem aviso (as demais não exigem campo extra). Sem login nem
 * banco: é a leitura do formulário público, a 390 e 1280 px, sem rolagem lateral.
 */
for (const largura of [390, 1280]) {
  test.describe(`T1590 — E729: a exigência da categoria aparece antes de marcar (${largura}px)`, () => {
    test.use({ viewport: { width: largura, height: 900 } });

    test("fotografia e mudança dizem o que pedem; as outras categorias não; nada marcado ainda", async ({ page }) => {
      await page.goto("/parceiros", { waitUntil: "domcontentloaded" });
      const grade = page.getByTestId("sp-categorias");
      await expect(grade).toBeVisible({ timeout: 30_000 });

      // Nada marcado: o aviso está lá antes de qualquer clique.
      await expect(page.getByTestId("sp-cat-fotografia")).not.toBeChecked();
      await expect(page.getByTestId("sp-cat-mudanca")).not.toBeChecked();

      const foto = page.getByTestId("sp-cat-exigencia-fotografia");
      const mudanca = page.getByTestId("sp-cat-exigencia-mudanca");
      await expect(foto).toBeVisible();
      await expect(foto).toHaveText("Pede o link do portfólio");
      await expect(mudanca).toBeVisible();
      await expect(mudanca).toHaveText("Pede empresa e veículo");

      // Cada aviso mora DENTRO do cartão da sua categoria.
      await expect(page.getByTestId("sp-cat-cartao-fotografia").getByTestId("sp-cat-exigencia-fotografia")).toHaveCount(1);
      await expect(page.getByTestId("sp-cat-cartao-mudanca").getByTestId("sp-cat-exigencia-mudanca")).toHaveCount(1);

      // Só as duas categorias que de fato exigem campo extra trazem aviso.
      expect(await page.locator('[data-testid^="sp-cat-exigencia-"]').count()).toBe(2);

      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  });
}
