import { test, expect } from "@playwright/test";

/**
 * T1589 — GUARDA DO E724 (#3498, merge na main em 09/11): no anúncio de EXEMPLO, o aviso ("Anúncio de exemplo: serve para
 * você ver como a Viva funciona. Nenhuma solicitação é enviada a ninguém.") é o PRIMEIRO elemento do cartão de preço —
 * antes do valor, das datas e do total —, e não só abaixo dos campos. Sem login nem banco (os exemplos são da casa).
 * 390 e 1280 px, sem rolagem lateral. A ordem é conferida pelo DOM (vale com o cartão aberto ou em folha).
 */
for (const largura of [390, 1280]) {
  test.describe(`T1589 — E724: aviso do exemplo primeiro no cartão de preço (${largura}px)`, () => {
    test.use({ viewport: { width: largura, height: 900 } });

    for (const id of ["ube-001", "ube-002"]) {
      test(`${id}: o aviso vem antes do preço no cartão`, async ({ page }) => {
        await page.goto(`/imoveis/${id}`, { waitUntil: "domcontentloaded" });
        await expect(page.locator("h1").first()).toBeVisible();
        const aviso = page.getByTestId("cartao-exemplo-aviso");
        expect(await aviso.count(), "o aviso do exemplo existe no cartão").toBeGreaterThanOrEqual(1);
        await expect(aviso.first()).toContainText("Nenhuma solicitação é enviada a ninguém");
        // Ordem no DOM: o aviso precede o preço do MESMO cartão (o primeiro filho do painel de preço).
        const ordem = await page.evaluate(() => {
          const a = document.querySelector('[data-testid="cartao-exemplo-aviso"]');
          const p = document.querySelector('[data-testid="cartao-lateral-preco"]');
          if (!a || !p) return { achou: false, antes: false, mesmoPai: false };
          return {
            achou: true,
            antes: !!(a.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING),
            mesmoPai: a.parentElement === p.parentElement,
          };
        });
        expect(ordem.achou, "aviso e preço presentes no DOM").toBe(true);
        expect(ordem.antes, "o aviso vem ANTES do preço").toBe(true);
        expect(ordem.mesmoPai, "aviso e preço estão no mesmo cartão").toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      });
    }
  });
}
