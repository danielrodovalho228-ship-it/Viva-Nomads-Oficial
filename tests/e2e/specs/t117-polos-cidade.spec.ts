import { test, expect } from "@playwright/test";

/**
 * T117 — Páginas por polo (ordem 9f68d9d3 item 3): pública, 390 e 1280 px.
 * A cidade lista os polos; a página do polo tem texto, valor médio (ou "dados insuficientes") e FAQ.
 */
for (const largura of [390, 1280]) {
  test.describe(`T117 — Polos a ${largura} px`, () => {
    test.use({ viewport: { width: largura, height: 844 } });

    test("a cidade lista o polo e a página do polo tem FAQ e preço honesto", async ({ page, request }) => {
      test.setTimeout(120_000);
      await page.goto("/cidades/uberlandia", { waitUntil: "networkidle" });
      await page.getByTestId("polos-da-cidade").getByRole("link", { name: /HC-UFU/ }).click();
      await expect(page).toHaveURL(/\/cidades\/uberlandia\/hc-ufu-umuarama$/);
      await expect(page.getByRole("heading", { level: 1 })).toContainText("HC-UFU");
      await expect(page.getByTestId("polo-faq")).toContainText("Perguntas frequentes");
      await expect(page.getByTestId("polo-precos")).toBeVisible();
      // Sem rolagem lateral
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(sobra).toBeLessThanOrEqual(1);
      // JSON-LD de FAQ presente no HTML (sem JS) e sem endereço/coordenada
      const html = await (await request.get("/cidades/uberlandia/hc-ufu-umuarama")).text();
      expect(html).toContain('"FAQPage"');
      expect(html).not.toMatch(/"latitude"|"longitude"|streetAddress/);
      const mapa = await (await request.get("/sitemap.xml")).text();
      expect(mapa).toContain("/cidades/uberlandia/hc-ufu-umuarama");
    });
  });
}

test("polo que não existe dá 404", async ({ page }) => {
  const r = await page.goto("/cidades/uberlandia/nao-existe");
  expect(r?.status()).toBe(404);
});
