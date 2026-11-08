import { test, expect } from "@playwright/test";

/*
  T1498 — T-C19, proposto pela QA (rodada 10:30, 08/11): a tela de entrada /auth tem rolagem lateral em celulares com menos de 378 px
  (a QA mediu em produção 58 px a 320, 38 a 340, 18 a 360 e 3 a 375; 0 a 390). Causa provável apontada por ela: o grid de duas colunas
  sem `grid-cols-1` abaixo de `lg` em src/app/auth/page.tsx (a correção é da pista dona do /auth).
  Asserções: com a página aberta, `scrollWidth <= innerWidth` e o cartão [data-testid=porta-formulario] termina dentro da tela.
  C19 CORRIGIDO pela Pista A no #3489 (draft; grid de uma coluna abaixo de lg): com a correção a spec é teste comum de regressão em todos os
  tamanhos (320, 360, 375, 390 e 1280 px). DEPENDÊNCIA: este PR tem como base o branch do #3489 e só passa com ele; antes do merge do #3489
  a versão com `test.fail` abaixo de 378 px (PR #3447) é a que vale. Quando o #3489 mergear, a base deste PR passa para a main e o #3447
  perde o sentido. Visitante.
*/
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("T1498 — C19: /auth sem rolagem lateral em celular pequeno", () => {
  for (const w of [320, 360, 375, 390, 1280] as const) {
    test(`/auth a ${w} px: sem rolagem lateral e o formulário cabe na tela`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 800 });
      const r = await page.goto("/auth", { waitUntil: "domcontentloaded" });
      expect(r?.status() ?? 0).toBeLessThan(400);
      const porta = page.getByTestId("porta-formulario");
      await expect(porta).toBeVisible({ timeout: 30_000 });
      const folga = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      const direita = await porta.evaluate((el) => el.getBoundingClientRect().right - innerWidth);
      expect(folga, "rolagem lateral").toBeLessThanOrEqual(0);
      expect(direita, "o formulário passa da borda direita").toBeLessThanOrEqual(0);
    });
  }
});
