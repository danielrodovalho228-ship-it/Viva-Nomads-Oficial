import { test, expect } from "@playwright/test";

/**
 * T169 — Taxa de serviço dos parceiros e CORS das páginas (ordens 39cc7c00, a4a13765 e a regra nova do Prompt 29).
 * 1) /parceiros e /parceiros/fotografos mostram a taxa única de 10% (sem as faixas R$ 40 / 60 / 80, que saíram)
 *    a 360 e 1280 px.
 * 2) Páginas HTML e /api/comissao não respondem "Access-Control-Allow-Origin: *".
 */
test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "chromium", "só no projeto do site (chromium)");
});

const TAMANHOS = [
  { nome: "360 px", width: 360, height: 800 },
  { nome: "1280 px", width: 1280, height: 800 },
];

for (const rota of ["/parceiros", "/parceiros/fotografos"]) {
  for (const t of TAMANHOS) {
    test(`${rota} mostra a taxa única de 10% a ${t.nome}`, async ({ page }) => {
      await page.setViewportSize({ width: t.width, height: t.height });
      await page.goto(rota);
      const taxa = page.getByTestId("taxa-servico-parceiros");
      await expect(taxa).toBeVisible();
      await expect(taxa).toContainText("10% sobre o valor do serviço");
      await expect(taxa).toContainText("todas as categorias");
      await expect(taxa).toContainText("A Viva não guarda o dinheiro");
      await expect(page.getByTestId("faixas-taxa-parceria")).toHaveCount(0);
      const estoura = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(estoura).toBe(false);
    });
  }
}

test("páginas HTML e /api/comissao não mandam Access-Control-Allow-Origin: *", async ({ request }) => {
  for (const rota of ["/", "/precos", "/como-funciona", "/para-proprietarios", "/empresas", "/api/comissao"]) {
    const res = await request.get(rota);
    expect(res.headers()["access-control-allow-origin"], rota).not.toBe("*");
  }
});
