import { test, expect } from "@playwright/test";

/*
  T1428 — E686 (#3256): em /parceiros/avaliadores, "Como é pago" diz que o avaliador define o próprio valor e o próprio prazo
  em cada pedido, e que a tabela da Viva para a cidade e o porte do imóvel é só uma referência — não mais "o valor segue a
  tabela da Viva". Visitante, 390 e 1280 px, sem texto cortado nem estouro horizontal.
*/
test.describe("T1428 — E686: Como é pago (avaliadores)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: o avaliador define valor e prazo; a tabela é referência`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      const r = await page.goto("/parceiros/avaliadores", { waitUntil: "domcontentloaded" });
      expect(r?.status() ?? 0).toBeLessThan(400);
      const bloco = page.getByTestId("recrutamento-pagamento");
      await expect(bloco).toBeVisible({ timeout: 30_000 });
      const texto = ((await bloco.innerText()) ?? "").replace(/\s+/g, " ");
      expect(texto).toContain("Como é pago");
      expect(texto).toContain("Você define o seu valor e o seu prazo em cada pedido");
      expect(texto).toContain("só uma referência");
      expect(texto, "a frase antiga saiu").not.toContain("O valor da avaliação segue a tabela da Viva");
      // E714 (#3395) troca a frase: "Quem paga é o dono do imóvel" vira "O dono do imóvel paga a avaliação…"; as duas dizem que o dono paga.
      expect(texto).toMatch(/Quem paga é o dono do imóvel|O dono do imóvel paga a avaliação/);
      await bloco.scrollIntoViewIfNeeded();
      const caixa = await bloco.boundingBox();
      expect(caixa!.x).toBeGreaterThanOrEqual(0);
      expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(w);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    });
  }
});
