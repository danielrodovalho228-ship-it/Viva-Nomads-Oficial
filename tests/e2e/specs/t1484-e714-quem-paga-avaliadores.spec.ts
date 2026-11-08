import { test, expect } from "@playwright/test";

/*
  T1484 — E714 (#3395): em /parceiros/avaliadores a regra de quem paga é dita ao AVALIADOR, sem falar com o dono: "O dono
  paga a avaliação, não o resultado." A frase velha "Você paga a avaliação" (dita ao dono) não aparece. Continua valendo o E686:
  o avaliador define o próprio valor e prazo e a tabela da Viva é só referência. Visitante, 390 e 1280 px, sem estouro horizontal.
  Fecha a segunda metade do T-E686 proposto pela QA (a primeira é a t1428).
*/
test.describe("T1484 — E714: quem paga a avaliação, dito ao avaliador", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: "O dono paga a avaliação, não o resultado"; nunca "Você paga a avaliação"`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      const r = await page.goto("/parceiros/avaliadores", { waitUntil: "domcontentloaded" });
      expect(r?.status() ?? 0).toBeLessThan(400);
      const bloco = page.getByTestId("recrutamento-pagamento");
      await expect(bloco).toBeVisible({ timeout: 30_000 });
      const texto = ((await bloco.innerText()) ?? "").replace(/\s+/g, " ");
      expect(texto).toContain("O dono paga a avaliação, não o resultado");
      const pagina = ((await page.locator("main").innerText()) ?? "").replace(/\s+/g, " ");
      expect(pagina, "a frase dita ao dono não vale para o avaliador").not.toContain("Você paga a avaliação");
      expect(texto).toContain("Você define o seu valor e o seu prazo em cada pedido");
      expect(texto).not.toContain("segue a tabela da Viva");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    });
  }
});
