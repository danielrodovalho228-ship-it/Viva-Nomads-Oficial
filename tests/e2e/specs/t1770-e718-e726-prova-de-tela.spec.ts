import { test, expect, type Page } from "@playwright/test";

/*
  T1770 — prova de tela do E718 e do E726 (ORDEM-DUET-710). As travas de unidade dos dois leem o código-fonte; a promessa
  dos dois é de tela, por isso esta spec confere o que o visitante vê, a 390 e a 1280 px.
   - E718: /para-proprietarios mostra os três blocos do mockup publico-proprietarios — "Pedidos de moradia da sua cidade
     chegam até você" (→ /dashboard/pedidos-cidade), "Publicamos para você" (→ /dashboard/imoveis/novo) e o "Simulador de
     rentabilidade" (→ /dashboard/simulador), sem nenhum valor de exemplo no simulador (E294).
   - E726: o selo "Anúncio de exemplo" tem uma posição só em todos os cartões da busca — abaixo da linha do bairro, alinhado
     à esquerda dela (antes ia à direita ou quebrava para baixo conforme a largura e o nome do bairro).
  Visitante; sem massa própria (a página é pública e os anúncios de exemplo são do produto).
*/
const LARGURAS = [390, 1280] as const;
const altura = (w: number) => (w === 390 ? 844 : 900);

async function semEsqueleto(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}

test.describe("T1770 — E718 e E726: a prova de tela", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const w of LARGURAS) {
    test(`E718 a ${w} px: os três blocos do mockup estão na página, com as portas certas e sem valor de exemplo`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: altura(w) });
      await page.goto("/para-proprietarios", { waitUntil: "domcontentloaded" });
      const blocos = page.getByTestId("proprietarios-blocos-mockup");
      await expect(blocos, "a secção dos blocos do mockup está na página").toBeVisible({ timeout: 30_000 });

      const pedidos = page.getByTestId("proprietarios-pedidos-cidade");
      await expect(pedidos.getByRole("heading", { name: "Pedidos de moradia da sua cidade chegam até você" })).toBeVisible();
      await expect(pedidos.getByRole("link", { name: "Ver pedidos da cidade" })).toHaveAttribute("href", "/dashboard/pedidos-cidade");

      const publicamos = page.getByTestId("proprietarios-publicamos");
      await expect(publicamos.getByRole("heading", { name: "Publicamos para você" })).toBeVisible();
      await expect(publicamos.getByRole("link", { name: "Pedir ajuda para publicar" })).toHaveAttribute("href", "/dashboard/imoveis/novo");

      const simulador = page.getByTestId("proprietarios-simulador");
      await expect(simulador.getByRole("heading", { name: "Simulador de rentabilidade" })).toBeVisible();
      await expect(simulador.getByTestId("proprietarios-calcular")).toHaveAttribute("href", "/dashboard/simulador");
      await expect(simulador, "nenhum valor de exemplo no simulador (E294)").not.toContainText(/R\$\s*\d/);

      // Os três, por esta ordem, um abaixo do outro (posição na página, não na janela) e dentro da largura da tela.
      const topos = await page.evaluate(() =>
        ["proprietarios-pedidos-cidade", "proprietarios-publicamos", "proprietarios-simulador"].map(
          (id) => document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect().top + window.scrollY,
        ),
      );
      for (let i = 1; i < topos.length; i++) expect(topos[i], `bloco ${i + 1} abaixo do bloco ${i}`).toBeGreaterThan(topos[i - 1]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), "sem rolagem lateral").toBeLessThanOrEqual(1);
    });

    test(`E726 a ${w} px: o selo "Anúncio de exemplo" fica abaixo do bairro, à esquerda, na mesma posição em todos os cartões`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: w, height: altura(w) });
      await page.goto("/buscar?exemplos=1", { waitUntil: "domcontentloaded" });
      const comSelo = page.getByTestId("cartao-imovel").filter({ has: page.getByTestId("cartao-selo-exemplo") });
      await expect(comSelo.first(), "há cartões de exemplo na busca").toBeVisible({ timeout: 40_000 });
      await semEsqueleto(page);
      const n = await comSelo.count();
      expect(n, "pelo menos dois cartões de exemplo para comparar a posição").toBeGreaterThanOrEqual(2);

      const medidas: { dx: number; abaixo: number; esquerda: number }[] = [];
      for (let i = 0; i < Math.min(n, 6); i++) {
        const cartao = comSelo.nth(i);
        await cartao.scrollIntoViewIfNeeded();
        const linha = (await cartao.getByTestId("cartao-local-linha").boundingBox())!;
        const selo = (await cartao.getByTestId("cartao-selo-exemplo").boundingBox())!;
        medidas.push({ dx: Math.round(selo.x - linha.x), abaixo: Math.round(selo.y - (linha.y + linha.height)), esquerda: Math.round(selo.x - linha.x) });
      }
      console.log(`T1770|E726|${w}|${JSON.stringify(medidas)}`);
      for (const [i, m] of medidas.entries()) {
        expect(m.abaixo, `cartão ${i + 1}: o selo começa abaixo da linha do bairro`).toBeGreaterThanOrEqual(-1);
        expect(Math.abs(m.esquerda), `cartão ${i + 1}: o selo alinha à esquerda com a linha do bairro`).toBeLessThanOrEqual(2);
      }
      expect(new Set(medidas.map((m) => m.dx)).size, "a mesma posição horizontal em todos os cartões").toBe(1);
    });
  }
});
