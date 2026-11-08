import { test, expect } from "@playwright/test";

/*
  T1564 — E724 (#3498): no anúncio de EXEMPLO (/imoveis/ube-001), o aviso "Anúncio de exemplo … Nenhuma solicitação é enviada a ninguém"
  é o primeiro elemento do cartão de preço: fica ACIMA do preço e dos campos/botões, visível, sem cortar nem estourar, a 1280 e a 390 px.
  Anúncio real (UUID) não mostra o aviso: coberto pelo teste de unidade do #3498 (isExemplo); aqui só o exemplo. Visitante.
*/
test.use({ storageState: { cookies: [], origins: [] } });

for (const [w, h] of [[1280, 900], [390, 844]] as const) {
  test(`a ${w} px: o aviso do exemplo vem antes do preço e dos botões do cartão`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/imoveis/ube-001", { waitUntil: "domcontentloaded" });
    const aviso = page.getByTestId("cartao-exemplo-aviso");
    await expect(aviso).toBeVisible({ timeout: 30_000 });
    await expect(aviso).toContainText("Nenhuma solicitação é enviada a ninguém");
    const preco = page.getByTestId("cartao-lateral-preco");
    await expect(preco).toBeVisible();
    const [a, p] = await Promise.all([aviso.boundingBox(), preco.boundingBox()]);
    expect(a!.y + a!.height, "o aviso termina antes de o preço começar").toBeLessThanOrEqual(p!.y + 1);
    // texto inteiro à vista: sem corte de altura e sem estourar a tela
    const corte = await aviso.evaluate((el) => el.scrollHeight - el.clientHeight);
    expect(corte, "texto cortado").toBeLessThanOrEqual(1);
    expect(a!.x + a!.width, "passa da borda direita").toBeLessThanOrEqual(w + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), "rolagem lateral").toBeLessThanOrEqual(1);
    // o aviso é o primeiro filho do cartão (nada de preço/data antes dele)
    const primeiro = await aviso.evaluate((el) => el.parentElement?.firstElementChild === el);
    expect(primeiro, "primeiro elemento do cartão").toBe(true);
  });
}
