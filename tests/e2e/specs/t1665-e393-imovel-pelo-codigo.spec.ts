import { mkdirSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { codigoDoImovel } from "../../../src/lib/imovel-pagina";

/*
  T1665 — E393 @E393: o anúncio abre pelo código público (VN-…), não só pelo UUID.
  Pega um anúncio real da busca (visitante), lê o código da própria página e abre /imoveis/<código> em três grafias:
  cai no endereço canônico /imoveis/<uuid>, com o mesmo título. Código sem anúncio: 404. 390 e 1280 px.
*/
const SAIDA = "tests/e2e/.artifacts/t1665";
const UUID = /\/imoveis\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/;

test.describe("T1665 — anúncio pelo código público @E393", () => {
  test.beforeAll(() => mkdirSync(SAIDA, { recursive: true }));

  for (const largura of [390, 1280]) {
    test(`${largura}px — /imoveis/VN-… abre o mesmo anúncio no endereço canônico`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/buscar", { waitUntil: "domcontentloaded" });
      const href = await page.locator('a[href^="/imoveis/"]').evaluateAll((as) =>
        as.map((a) => a.getAttribute("href") ?? "").find((h) => /^\/imoveis\/[0-9a-f]{8}-[0-9a-f-]{27}$/.test(h)),
      );
      expect(href, "um anúncio real (uuid) na busca").toBeTruthy();
      const id = UUID.exec(href!)![1];
      const codigo = codigoDoImovel(id);

      await page.goto(`/imoveis/${id}`, { waitUntil: "domcontentloaded" });
      const titulo = (await page.locator("h1").first().textContent())?.trim();
      await expect(page.getByText(`Código ${codigo}`).first()).toBeVisible();

      for (const grafia of [codigo, codigo.toLowerCase(), codigo.replace("-", "")]) {
        const resp = await page.goto(`/imoveis/${grafia}`, { waitUntil: "domcontentloaded" });
        expect(resp?.status()).toBe(200);
        await expect(page).toHaveURL(new RegExp(`/imoveis/${id}$`));
        await expect(page.locator("h1").first()).toHaveText(titulo!);
      }
      await page.screenshot({ path: `${SAIDA}/preview-imovel-pelo-codigo-${largura}.png` });

      const nenhum = await page.goto("/imoveis/VN-000000", { waitUntil: "domcontentloaded" });
      expect(nenhum?.status()).toBe(404);
    });
  }
});
