import { test, expect, type Page } from "@playwright/test";

/*
  T1634 — E924 e E925 (Phoenix, A-253 e A-254), topo da página do imóvel. Visitante; 390 e 1280 px.
  E924: os selos do topo variavam de página para página "sem padrão aparente". As diferenças entre anúncios são do dado de cada um;
    o que não tinha justificativa era o cartão abrir com a pílula do nível e o topo da página não ter o nível. Agora o topo da página
    tem a MESMA composição e ordem do cartão do mesmo anúncio: nível em pílula própria, com a palavra; depois verificado, preço justo,
    pets e negociação, juntos.
  E925: a nota do imóvel e a do proprietário conviviam sem rótulo. Agora: "avaliações do imóvel" e "avaliações do proprietário".
    Os números não mudam.
*/
const sem = (s: string) => s.replace(/ /g, " ").replace(/\s+/g, " ").trim();
const IDS = ["ube-001", "ube-002", "ube-003", "ube-004", "ube-014"];

/** Composição do cartão da busca: a pílula do nível e os símbolos, na ordem em que estão na foto. */
async function composicaoDoCartao(page: Page, id: string): Promise<string[]> {
  const cartao = page.getByTestId("cartao-imovel").filter({ has: page.locator(`a[href="/imoveis/${id}"]`) }).first();
  await expect(cartao.getByTestId("cartao-preco-mes")).toBeVisible({ timeout: 40_000 });
  return cartao.evaluate((el) => {
    const nivel = el.querySelector<HTMLElement>('[data-testid="card-nivel"]');
    const simbolos = [...el.querySelectorAll<HTMLElement>('[data-testid="selos-simbolos"] [data-selo]')].map((s) => s.dataset.selo!);
    return [...(nivel ? [`nivel:${nivel.dataset.nivel}`] : []), ...simbolos];
  });
}

/** Composição do topo da página: os itens da fileira de selos, na ordem em que aparecem. */
async function composicaoDoTopo(page: Page): Promise<{ ordem: string[]; textos: string[] }> {
  const itens = page.locator('#visao-geral header [data-testid="selos-anuncio"] [data-selo]');
  return {
    ordem: await itens.evaluateAll((els) => els.map((e) => ((e as HTMLElement).dataset.selo === "nivel" ? `nivel:${(e as HTMLElement).dataset.nivel}` : (e as HTMLElement).dataset.selo!))),
    textos: (await itens.allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim()),
  };
}

test.describe("T1634 — E924 e E925: topo da página do imóvel", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  for (const largura of [390, 1280] as const) {
    test(`E924 a ${largura} px: o topo da página tem a mesma composição e ordem de selos do cartão do mesmo anúncio`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto("/buscar?exemplos=1", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      const doCartao: Record<string, string[]> = {};
      for (const id of IDS) doCartao[id] = await composicaoDoCartao(page, id);
      const doTopo: Record<string, string[]> = {};
      for (const id of IDS) {
        await page.goto(`/imoveis/${id}`, { waitUntil: "domcontentloaded" });
        await expect(page.locator("#visao-geral header h1")).toBeVisible({ timeout: 40_000 });
        const topo = await composicaoDoTopo(page);
        doTopo[id] = topo.ordem;
        // A pílula do nível abre a fileira, com a palavra (não só o símbolo).
        expect(topo.ordem[0], `${id}: o topo abre com o nível`).toMatch(/^nivel:/);
        expect(topo.textos[0], `${id}: nível com a palavra`).toMatch(/^(Essencial|Conforto|Premium)$/);
      }
      expect(doTopo, "topo da página = cartão, anúncio a anúncio").toEqual(doCartao);
      // A diferença entre anúncios é do dado: "Preço justo" só no ube-001 (o único com o valor do Airbnb declarado).
      expect(doTopo["ube-001"]).toEqual(["nivel:essencial", "precoJusto", "pets"]);
      expect(doTopo["ube-002"]).toEqual(["nivel:essencial", "pets"]);
      for (const id of ["ube-003", "ube-004", "ube-014"]) expect(doTopo[id], id).toEqual(["nivel:essencial"]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    });

    test(`E925 a ${largura} px: a nota do imóvel e a do proprietário têm rótulos distintos; os números são os mesmos`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto("/imoveis/ube-001", { waitUntil: "domcontentloaded" });
      const doImovel = page.getByTestId("estrelas-titulo");
      await expect(doImovel).toBeVisible({ timeout: 40_000 });
      expect(sem(await doImovel.innerText())).toBe("4,7 · 3 avaliações do imóvel");
      const doDono = page.locator("#proprietario").getByTestId("proprietario-reputacao");
      await doDono.scrollIntoViewIfNeeded();
      expect(sem(await doDono.innerText())).toBe("4,7 · 11 avaliações do proprietário");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    });
  }
});
