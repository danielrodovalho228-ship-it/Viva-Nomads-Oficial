import { test, expect } from "@playwright/test";
import { caucaoDoPrimeiroBloco, NOTA_CAUCAO } from "../../../src/lib/reserva-imovel";

/*
  T1586 — E752 (#3579): a Caução mostra o valor do 1º bloco (50% do bloco, teto de 3x o valor mensal) e o texto público diz que é paga DIRETO ao
  proprietário e que a Viva não recebe nem segura (nada de "poupança"). Guarda: regra do valor (lógica) + /como-funciona sem "poupança" (390 e 1280 px).
*/
test("E752: caução do 1º bloco = regra do contrato; estadia mínima define o bloco (1 a 3 meses)", () => {
  const um = caucaoDoPrimeiroBloco(3000, 30)!;
  expect(um.meses).toBe(1);
  expect(um.valor).toBeGreaterThan(0);
  expect(um.valor).toBeLessThanOrEqual(3 * 3000);
  const padrao = caucaoDoPrimeiroBloco(3000, null)!;
  expect(padrao.meses).toBe(2);
  expect(caucaoDoPrimeiroBloco(0, 30)).toBeNull();
  expect(NOTA_CAUCAO).toMatch(/direto ao proprietário/);
  expect(NOTA_CAUCAO).toMatch(/Viva não recebe nem segura/);
});

test.describe("E752 — /como-funciona", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  for (const [w, h] of [[390, 844], [1280, 900]] as const) {
    test(`a ${w} px: sem 'poupança' na caução, com 'direto ao proprietário'`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/como-funciona", { waitUntil: "domcontentloaded" });
      const corpo = await page.locator("body").innerText();
      expect(corpo).not.toMatch(/poupança/i);
      expect(corpo).toMatch(/direto ao proprietário/i);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), "rolagem lateral").toBeLessThanOrEqual(1);
    });
  }
});
