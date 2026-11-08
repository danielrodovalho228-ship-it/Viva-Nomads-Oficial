import { test, expect } from "@playwright/test";

/*
  T1459 — quatro merges da Pista A, já na main, que mexem no layout público. Visitante, sem estouro horizontal.
    C9 (#3349): o nome do local no cartão da busca não é cortado em uma linha com reticências: pode quebrar em até 2 linhas.
    E710 (#3325): em /buscar, no celular as ações (Mais filtros · Ordenar · Mapa) ficam numa linha PRÓPRIA, dentro da tela;
       do tablet para cima, filtros e ações dividem a mesma linha.
    E711 (#3323): /parceiros não tem mais o "Seja parceiro" duplicado no topo; a porta "Quero ser parceiro" segue.
    E709 (#3324): a página do imóvel (e o container público) deixa a faixa da direita livre para o botão redondo
       "Fale com a Viva" (--faixa-flutuante = 5 rem) em 768 e 1280 px.
  390 e 1280 px (E709 também a 768).
*/
const semEstouro = (page: import("@playwright/test").Page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

test.describe("T1459 — C9, E709, E710, E711: layout público", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const w of [1280, 390] as const) {
    test(`C9 a ${w} px: nome do local no cartão sem corte em uma linha`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await page.goto("/buscar", { waitUntil: "domcontentloaded" });
      const locais = page.getByTestId("cartao-local");
      await expect(locais.first()).toBeVisible({ timeout: 40_000 });
      const estilos = await locais.evaluateAll((els) =>
        els.slice(0, 12).map((e) => {
          const cs = getComputedStyle(e as HTMLElement);
          return { espaco: cs.whiteSpace, clamp: cs.getPropertyValue("-webkit-line-clamp"), estouroX: (e as HTMLElement).scrollWidth - (e as HTMLElement).clientWidth };
        }),
      );
      for (const e of estilos) {
        expect(e.espaco, "o nome pode quebrar de linha").not.toBe("nowrap");
        expect(e.estouroX, "sem corte horizontal").toBeLessThanOrEqual(1);
      }
      expect(await semEstouro(page)).toBeLessThanOrEqual(1);
    });

    test(`E710 a ${w} px: ações da busca ${w === 390 ? "em linha própria" : "na mesma linha dos filtros"}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await page.goto("/buscar", { waitUntil: "domcontentloaded" });
      const filtros = page.getByTestId("pilulas-filtros");
      const acoes = page.getByTestId("pilulas-acoes");
      await expect(acoes).toBeVisible({ timeout: 40_000 });
      const f = await filtros.boundingBox();
      const a = await acoes.boundingBox();
      expect(a!.x, "as ações começam dentro da tela").toBeGreaterThanOrEqual(0);
      expect(a!.x + a!.width, "as ações terminam dentro da tela").toBeLessThanOrEqual(w + 1);
      if (w === 390) expect(a!.y, "no celular as ações ficam abaixo da faixa de filtros").toBeGreaterThanOrEqual(f!.y + f!.height - 1);
      else expect(Math.abs(a!.y - f!.y), "do tablet para cima é uma linha só").toBeLessThan(40);
      expect(await semEstouro(page)).toBeLessThanOrEqual(1);
    });

    test(`E711 a ${w} px: /parceiros sem o "Seja parceiro" duplicado, com a porta "Quero ser parceiro"`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      const r = await page.goto("/parceiros", { waitUntil: "domcontentloaded" });
      expect(r?.status() ?? 0).toBeLessThan(400);
      await expect(page.locator("main").first()).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("seja-parceiro-topo")).toHaveCount(0);
      await expect(page.getByText(/Quero ser parceiro/i).first()).toBeVisible();
      expect(await semEstouro(page)).toBeLessThanOrEqual(1);
    });
  }

  for (const w of [1280, 768] as const) {
    test(`E709 a ${w} px: a faixa da direita fica livre para o botão "Fale com a Viva"`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 });
      const r = await page.goto("/imoveis/ube-005", { waitUntil: "domcontentloaded" });
      expect(r?.status() ?? 0).toBeLessThan(400);
      const area = page.getByTestId("imovel-largura-total");
      await expect(area).toBeVisible({ timeout: 30_000 });
      const folga = await area.evaluate((e) => parseFloat(getComputedStyle(e).paddingRight));
      expect(folga, "folga à direita de pelo menos 5 rem (80 px)").toBeGreaterThanOrEqual(79);
      expect(await semEstouro(page)).toBeLessThanOrEqual(1);
    });
  }
});
