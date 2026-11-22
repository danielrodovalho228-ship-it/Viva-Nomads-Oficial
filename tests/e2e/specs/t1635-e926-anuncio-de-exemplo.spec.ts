import { test, expect, type Page } from "@playwright/test";

/*
  T1635 — E926 (Phoenix, RELATORIO-045, A-259): a mesma página usava dois nomes para o anúncio de exemplo. O cartão dizia "Anúncio de
  exemplo" e a página do imóvel, "Exemplo ilustrativo"; o aviso do bloco do proprietário dizia "Anúncio de demonstração".
  Termo único em todas as superfícies que mostram o anúncio de exemplo: "Anúncio de exemplo".
  Varredura: cartão na busca e nos favoritos, página do imóvel (selo do topo, faixa do proprietário, avaliações, bloco "Sobre o
  proprietário", barra do celular) e o perfil do proprietário de exemplo. Visitante; 390 e 1280 px.
*/
const TERMO = "Anúncio de exemplo";
const NOMES_ANTIGOS = /exemplo ilustrativo|an[úu]ncios? de demonstra[çc][ãa]o/i;
const sem = (s: string) => s.replace(/ /g, " ").replace(/\s+/g, " ").trim();

/** O texto visível da tela inteira não tem nenhum dos nomes antigos (o termo único é conferido selo a selo, em cada superfície). */
async function semNomesAntigos(page: Page, onde: string) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  const texto = sem(await page.locator("body").innerText());
  const achado = NOMES_ANTIGOS.exec(texto);
  expect(achado ? texto.slice(Math.max(0, achado.index - 40), achado.index + 60) : null, `${onde}: nome antigo na tela`).toBeNull();
}

test.describe("T1635 — E926: um nome só para o anúncio de exemplo", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  for (const largura of [390, 1280] as const) {
    test(`a ${largura} px: cartão, página do imóvel e perfil do proprietário de exemplo dizem "Anúncio de exemplo"`, async ({ page }) => {
      test.setTimeout(150_000);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });

      // 1) Cartão na busca.
      await page.goto("/buscar?exemplos=1", { waitUntil: "domcontentloaded" });
      const cartao = page.getByTestId("cartao-imovel").filter({ has: page.locator('a[href="/imoveis/ube-001"]') }).first();
      await expect(cartao.getByTestId("cartao-selo-exemplo")).toHaveText(TERMO, { timeout: 40_000 });
      await semNomesAntigos(page, "busca");

      // 2) Página do imóvel: todos os selos de exemplo dizem o mesmo que o cartão.
      await page.goto("/imoveis/ube-001", { waitUntil: "domcontentloaded" });
      await expect(page.locator("#visao-geral header h1")).toBeVisible({ timeout: 40_000 });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await expect(page.getByTestId("selo-exemplo-topo")).toHaveText(TERMO);
      await expect(page.getByTestId("faixa-proprietario").getByTestId("selo-exemplo")).toHaveText(TERMO);
      await expect(page.getByTestId("avaliacoes-exemplo").getByTestId("selo-exemplo")).toHaveText(TERMO);
      const dono = page.getByTestId("sobre-proprietario");
      await expect(dono.getByTestId("selo-exemplo")).toHaveText(TERMO);
      await expect(dono.getByTestId("proprietario-exemplo")).toHaveText(/^Anúncio de exemplo: nos anúncios reais/);
      const selos = await page.getByTestId("selo-exemplo").allInnerTexts();
      expect(selos.length, "faixa, avaliações e bloco do proprietário").toBeGreaterThanOrEqual(3);
      expect([...new Set(selos.map(sem))], "todos os selos de exemplo da página").toEqual([TERMO]);
      await semNomesAntigos(page, "página do imóvel");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

      // 3) Perfil do proprietário de exemplo (lista os mesmos anúncios de exemplo, em cartões).
      await page.goto("/proprietario/exemplo-1", { waitUntil: "domcontentloaded" });
      const perfil = page.getByTestId("pagina-proprietario");
      await expect(perfil.getByTestId("faixa-exemplo").getByTestId("selo-exemplo")).toHaveText(TERMO, { timeout: 40_000 });
      await expect(page).toHaveTitle(/proprietário de anúncio de exemplo/);
      expect([...new Set((await perfil.getByTestId("selo-exemplo").allInnerTexts()).map(sem))]).toEqual([TERMO]);
      await semNomesAntigos(page, "perfil do proprietário de exemplo");

      // 4) Favoritos do visitante com o anúncio de exemplo guardado no aparelho: o mesmo cartão, o mesmo termo.
      await page.addInitScript(() => localStorage.setItem("vivanomads-favorites", JSON.stringify({ state: { owner: null, ids: ["ube-001"] }, version: 0 })));
      await page.goto("/favoritos", { waitUntil: "domcontentloaded" });
      const fav = page.getByTestId("cartao-imovel").filter({ has: page.locator('a[href="/imoveis/ube-001"]') }).first();
      if (await fav.count()) {
        await expect(fav.getByTestId("cartao-selo-exemplo")).toHaveText(TERMO);
        await semNomesAntigos(page, "favoritos");
      }
    });
  }
});
