import { test, expect } from "@playwright/test";

/*
  T2062 — E735 / C19 (Pista 3; autorizado pelo Gerente em 17/11) @E735 @ao-vivo-seguro
  Regra (correção #3489, medida pelo QA em 08–09/11): a porta /auth — entrar e cadastro com senha — não transborda de
  lado no celular pequeno: a 320, 360 e 375 px a página não rola na horizontal e o formulário cabe inteiro na tela.
  Antes do #3489: 58 px a 320, 18 px a 360, 3 px a 375. Trava de regressão (t20xx próprio, não o t1498 do draft
  #3495). Visitante, só leitura: abre a página e mede; não envia nada.
*/
test.use({ storageState: { cookies: [], origins: [] } });

for (const rota of ["/auth", "/auth?senha=1"]) {
  for (const largura of [320, 360, 375]) {
    test(`T2062 — E735: ${rota} a ${largura} px sem transbordo lateral @E735 @ao-vivo-seguro`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 800 });
      const r = await page.goto(rota, { waitUntil: "domcontentloaded" });
      expect(r?.status()).toBe(200);
      const formulario = page.getByTestId("porta-formulario");
      await expect(formulario).toBeVisible({ timeout: 30_000 });
      await expect(page.locator("form").first()).toBeVisible({ timeout: 30_000 });

      const lateral = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(lateral, `${rota} rola ${lateral} px de lado a ${largura} px`).toBeLessThanOrEqual(0);

      const caixa = await formulario.boundingBox();
      expect(caixa, "coluna do formulário com caixa").not.toBeNull();
      expect(caixa!.x, "formulário começa dentro da tela").toBeGreaterThanOrEqual(0);
      expect(caixa!.x + caixa!.width, `formulário termina dentro da tela (${largura} px)`).toBeLessThanOrEqual(largura);
    });
  }
}
