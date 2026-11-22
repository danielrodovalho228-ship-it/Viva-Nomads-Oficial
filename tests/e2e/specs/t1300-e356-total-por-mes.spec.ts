import { test, expect } from "@playwright/test";

/*
  T1300 — E356: TODO cartão da mesma grade tem a linha do total da estadia ("R$ Y em N meses", com 1 mês "R$ X em 1 mês"), para a
  comparação de preço não depender de o vizinho ter ou não estadia mínima plurimensal. 390 e 1280, página pública da busca.
  E899 (Daniel, 13/11): a linha "Total por mês, tudo incluído" (cartao-total-rotulo) saiu do cartão. Quem diz o que o total inclui
  é o aviso curto que fecha a linha do total: "tudo incluído" (contas fixas) ou "água, luz e gás à parte" (contas medidas).
*/
for (const [largura, altura] of [[390, 844], [1280, 900]] as const) {
  test(`a ${largura} px: todo cartão da /buscar mostra o total da estadia com o aviso curto`, { tag: ["@E356", "@ao-vivo-seguro"] }, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: altura });
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    const cartoes = page.getByTestId("cartao-imovel");
    await expect(cartoes.first()).toBeVisible({ timeout: 30_000 });
    const n = await cartoes.count();
    expect(n).toBeGreaterThan(1);
    for (let i = 0; i < Math.min(n, 12); i++) {
      const c = cartoes.nth(i);
      await expect(c.getByTestId("cartao-total-rotulo")).toHaveCount(0);
      // E923: contas fixas sem estimativa dizem "água, luz e gás não informados" (antes: "tudo incluído").
      await expect(c.getByTestId("cartao-aviso")).toHaveText(/^(tudo incluído|água, luz e gás à parte|água, luz e gás não informados)$/);
      await expect(c.getByTestId("cartao-total-estadia")).toContainText(/R\$\s?[\d.]+(,\d{2})? em \d+ m(ês|eses)/);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });
}
