import { test, expect } from "@playwright/test";

/**
 * T267 — D-V da t249 (/buscar a 1280 px: 4 imagens "acima da dobra" sem carregar). Eram a 5ª foto do carrossel dos
 * cartões, escondida pelo corte do cartão. Agora cada cartão só põe na página a foto visível e a próxima; ao passar
 * para a próxima, a seguinte entra. Nenhuma imagem dentro da tela fica sem carregar. 390 e 1280 px.
 */
test.use({ storageState: { cookies: [], origins: [] } });

for (const largura of [390, 1280] as const) {
  test(`${largura}px — /buscar: só a foto visível e a próxima de cada cartão; todas carregadas`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    const cartoes = page.getByTestId("cartao-imovel");
    await expect(cartoes.first()).toBeVisible({ timeout: 25_000 });

    const porCartao = await cartoes.evaluateAll((els) =>
      els.map((el) => ({
        fotos: el.querySelectorAll('[data-fotos] img').length,
        espacos: el.querySelectorAll("[data-foto-depois]").length,
        pontos: el.querySelectorAll('[data-testid="cartao-pontos"] span').length,
      })),
    );
    const comCarrossel = porCartao.filter((c) => c.pontos > 2);
    expect(comCarrossel.length, "a busca do laboratório tem cartões com 3+ fotos").toBeGreaterThan(0);
    for (const c of porCartao) expect(c.fotos).toBeLessThanOrEqual(2);
    for (const c of comCarrossel) expect(c.fotos + c.espacos).toBe(c.pontos);

    // Toda imagem que cruza a tela (sem rolar) termina de carregar.
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            Array.from(document.images).filter((im) => {
              const r = im.getBoundingClientRect();
              return r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && !(im.complete && im.naturalWidth > 0);
            }).length,
          ),
        { timeout: 8_000 },
      )
      .toBe(0);

    // Passar para a 2ª foto põe a 3ª na página.
    const idx = porCartao.findIndex((c) => c.pontos > 2);
    const fotos = cartoes.nth(idx).locator("[data-fotos]");
    await fotos.scrollIntoViewIfNeeded();
    await fotos.evaluate((el) => el.scrollTo({ left: el.clientWidth }));
    await expect(fotos.locator("img")).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });
}
