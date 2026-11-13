import { test, expect } from "@playwright/test";

/*
  T1300 — E356: o cartão da busca diz o que o preço grande é ("Total por mês, tudo incluído") e TODO cartão da mesma grade tem a
  linha do total da estadia ("R$ Y em N meses", com 1 mês "R$ X em 1 mês"), para a comparação de preço não depender de o vizinho
  ter ou não estadia mínima plurimensal. 390 e 1280, página pública da busca.
*/
for (const [largura, altura] of [[390, 844], [1280, 900]] as const) {
  test(`a ${largura} px: todo cartão da /buscar rotula o preço e mostra o total da estadia`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: altura });
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    const cartoes = page.getByTestId("cartao-imovel");
    await expect(cartoes.first()).toBeVisible({ timeout: 30_000 });
    const n = await cartoes.count();
    expect(n).toBeGreaterThan(1);
    for (let i = 0; i < Math.min(n, 12); i++) {
      const c = cartoes.nth(i);
      // E899 (asserção alterada, decisão do Daniel de 13/11): o rótulo "Total por mês, tudo incluído" virou o aviso curto no fim da
      // linha do total — "tudo incluído" (contas fixas) ou "água, luz e gás à parte" (contas medidas).
      await expect(c.getByTestId("cartao-total-rotulo")).toHaveCount(0);
      await expect(c.getByTestId("cartao-aviso")).toHaveText(/^(tudo incluído|água, luz e gás à parte)$/);
      await expect(c.getByTestId("cartao-total-estadia")).toContainText(/R\$\s?[\d.]+(,\d{2})? em \d+ m(ês|eses)/);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });
}
