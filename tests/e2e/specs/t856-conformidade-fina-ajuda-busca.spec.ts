import { test, expect, type Page } from "@playwright/test";

/*
  T856 — CONFORMIDADE FINA DA AJUDA E DA BUSCA (Pista C, 01/11; merge #1845). O merge trouxe só teste de fonte; aqui a
  cor de verdade, pelo estilo computado, a 390 e 1280 px, como visitante:
   1) /ajuda: os títulos das seções (temas e documentos) e o título de cada tema saem no verde da marca (forest);
   2) /buscar?local=Uberlândia: na contagem "N imóveis em <lugar>", só o lugar sai em verde (titulo-busca-local), com
      o texto inteiro igual ao de antes ("N imóveis em Uberlândia"); o número e o "imóveis em" ficam na cor do texto.
  O verde de referência é o de um elemento com a classe text-forest criado na própria página (sem cor fixa no teste).
*/
const LARGURAS = [390, 1280] as const;

async function verdeDaMarca(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.createElement("span");
    el.className = "text-forest";
    document.body.appendChild(el);
    const cor = getComputedStyle(el).color;
    el.remove();
    return cor;
  });
}
const cor = (page: Page, seletor: string) => page.locator(seletor).first().evaluate((el) => getComputedStyle(el).color);

for (const largura of LARGURAS) {
  test.describe(`T856 — conformidade fina da ajuda e da busca (#1845) @${largura}`, () => {
    test.use({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });

    test(`/ajuda: títulos das seções e dos temas em verde (${largura} px)`, async ({ page }) => {
      await page.goto("/ajuda", { waitUntil: "domcontentloaded" });
      await expect(page.locator("#ajuda-temas-titulo")).toBeVisible({ timeout: 20_000 });
      const verde = await verdeDaMarca(page);
      expect(await cor(page, "#ajuda-temas-titulo"), "título 'temas'").toBe(verde);
      expect(await cor(page, "#ajuda-docs-titulo"), "título 'documentos'").toBe(verde);
      // O título de cada tema: o <span> de título dentro da seção de temas.
      const temas = page.locator('section[aria-labelledby="ajuda-temas-titulo"] span.font-title');
      expect(await temas.count(), "temas na ajuda").toBeGreaterThan(0);
      const cores = await temas.evaluateAll((els) => els.map((e) => getComputedStyle(e).color));
      for (const c of cores) expect(c, "título do tema").toBe(verde);
    });

    test(`/buscar: na contagem, só o lugar em verde (${largura} px)`, async ({ page }) => {
      await page.goto(`/buscar?local=${encodeURIComponent("Uberlândia")}`, { waitUntil: "domcontentloaded" });
      const lugar = page.getByTestId("titulo-busca-local");
      await expect
        .poll(async () => (await lugar.count()) > 0 || (await page.getByText("Nenhum imóvel com estes filtros").count()) > 0, { timeout: 30_000 })
        .toBe(true);
      test.skip((await lugar.count()) === 0, "nenhum imóvel em Uberlândia neste ambiente: a contagem não tem lugar");
      await expect(lugar.first()).toHaveText("Uberlândia");
      const pai = page.getByTestId("titulo-busca");
      await expect(pai).toHaveText(/^\d+ (imóvel|imóveis) em Uberlândia$/);
      const verde = await verdeDaMarca(page);
      expect(await lugar.first().evaluate((el) => getComputedStyle(el).color), "o lugar").toBe(verde);
      expect(await pai.evaluate((el) => getComputedStyle(el).color), "o resto da contagem fica na cor do texto").not.toBe(verde);
    });
  });
}
