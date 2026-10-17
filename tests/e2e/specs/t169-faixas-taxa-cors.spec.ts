import { test, expect } from "@playwright/test";

/**
 * T167 — Faixas da taxa de parceria e CORS das páginas (ordens 39cc7c00 e a4a13765).
 * 1) /parceiros e /parceiros/fotografos mostram as 3 faixas (R$ 40 / 60 / 80) a 360 e 1280 px.
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
    test(`${rota} mostra as 3 faixas da taxa a ${t.nome}`, async ({ page }) => {
      await page.setViewportSize({ width: t.width, height: t.height });
      await page.goto(rota);
      const tabela = page.getByTestId("faixas-taxa-parceria");
      await expect(tabela).toBeVisible();
      await expect(tabela).toContainText("Até 20 fotos");
      await expect(tabela).toContainText("R$ 40");
      await expect(tabela).toContainText("21 a 40 fotos");
      await expect(tabela).toContainText("R$ 60");
      await expect(tabela).toContainText("Acima de 40 fotos");
      await expect(tabela).toContainText("R$ 80");
      await expect(tabela).toContainText("sem mensalidade e sem exclusividade");
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
