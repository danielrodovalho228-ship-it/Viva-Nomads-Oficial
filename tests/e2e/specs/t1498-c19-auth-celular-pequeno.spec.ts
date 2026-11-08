import { test, expect } from "@playwright/test";

/*
  T1498 — T-C19, proposto pela QA (rodada 10:30, 08/11): a tela de entrada /auth tem rolagem lateral em celulares com menos de 378 px
  (a QA mediu em produção 58 px a 320, 38 a 340, 18 a 360 e 3 a 375; 0 a 390). Causa provável apontada por ela: o grid de duas colunas
  sem `grid-cols-1` abaixo de `lg` em src/app/auth/page.tsx (a correção é da pista dona do /auth).
  Asserções: com a página aberta, `scrollWidth <= innerWidth` e o cartão [data-testid=porta-formulario] termina dentro da tela.
  A 320, 360 e 375 px o defeito reproduz → test.fail ligado ao item C19 da QA (quem corrigir remove o test.fail no mesmo PR); a 390 e a 1280
  é teste comum. Se o lab mostrar que algum tamanho já passa, ajusto. Visitante.
*/
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("T1498 — C19: /auth sem rolagem lateral em celular pequeno", () => {
  for (const w of [320, 360, 375, 390, 1280] as const) {
    test(`/auth a ${w} px: sem rolagem lateral e o formulário cabe na tela`, async ({ page }) => {
      test.fail(w < 378, `C19 (QA 10:30): /auth rola para o lado a ${w} px (grid sem grid-cols-1 abaixo de lg)`);
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
