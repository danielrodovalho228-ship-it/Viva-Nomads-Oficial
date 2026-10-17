import { test, expect, type Page } from "@playwright/test";

/**
 * T162 — ordem 544b148a: pino do mapa = total do cartão (também com filtro), cada atalho de preço/categoria
 * da home leva a tantos resultados quanto anuncia, e nenhuma caixinha de comparar fica sob a barra fixa. Público, 390 e 1280 px.
 */
const brl = (t: string) => Number((t.match(/R\$\s*([\d.]+)/)?.[1] ?? "0").replace(/\./g, ""));

async function pinoIgualCartao(page: Page) {
  const pinos = page.getByTestId("pin-mapa");
  test.skip((await pinos.count()) === 0, "mapa não desenhou pinos neste ambiente");
  const ids = await pinos.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.id ?? ""));
  let conferidos = 0;
  for (const id of ids) {
    const cartao = page.locator(`[data-testid="card-resultado"]:has(a[href="/imoveis/${id}"])`).first();
    if ((await cartao.count()) === 0) continue;
    const total = brl(await cartao.getByTestId("cartao-total-mes").innerText());
    const pino = brl(await page.locator(`[data-testid="pin-mapa"][data-id="${id}"]`).first().innerText());
    expect(pino, `pino do imóvel ${id}`).toBe(total);
    conferidos++;
  }
  expect(conferidos).toBeGreaterThan(0);
}

for (const largura of [390, 1280]) {
  test.describe(`T162 — pino × cartão e atalhos (${largura} px)`, () => {
    test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: largura, height: largura === 390 ? 844 : 900 } });

    test("pino mostra o mesmo total do cartão, sem e com filtro", async ({ page }) => {
      await page.goto("/buscar", { waitUntil: "networkidle" });
      await pinoIgualCartao(page);
      await page.goto("/buscar?preco=3500", { waitUntil: "networkidle" });
      await pinoIgualCartao(page);
    });

    test("cada atalho da home: contagem anunciada = resultados na /buscar", async ({ page }) => {
      test.setTimeout(180_000); // vários atalhos, um carregamento da /buscar cada (lab: 45 s estourava)
      await page.goto("/", { waitUntil: "networkidle" });
      const atalhos = page.locator('a[href^="/buscar?"]').filter({ hasText: /\d+ imóve/ });
      const n = await atalhos.count();
      test.skip(n === 0, "home sem atalhos com contagem");
      const alvos: { href: string; qtd: number }[] = [];
      for (let i = 0; i < n; i++) {
        const a = atalhos.nth(i);
        const qtd = Number(((await a.innerText()).match(/(\d+) imóve/) ?? [])[1]);
        alvos.push({ href: (await a.getAttribute("href"))!, qtd });
      }
      for (const { href, qtd } of alvos) {
        expect(qtd, href).toBeGreaterThan(0);
        await page.goto(href, { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("card-resultado"), href).toHaveCount(qtd, { timeout: 20_000 });
      }
    });

    test("parâmetro desconhecido é ignorado, sem chip fantasma", async ({ page }) => {
      await page.goto("/buscar?parametro_que_nao_existe=1", { waitUntil: "networkidle" });
      await expect(page.getByTestId("limpar-filtros")).toHaveCount(0);
      await expect(page.getByTestId("card-resultado").first()).toBeVisible();
    });

    test("com itens marcados, nenhuma caixinha de comparar fica sob a barra fixa", async ({ page }) => {
      await page.goto("/buscar", { waitUntil: "networkidle" });
      const marcas = page.getByTestId("marcar-comparar");
      test.skip((await marcas.count()) < 1, "sem cartões");
      await marcas.first().check();
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const barra = page.getByTestId("barra-comparar").locator("> div");
      await expect(barra).toBeVisible();
      const topo = (await barra.boundingBox())!.y;
      for (let i = 0; i < (await marcas.count()); i++) {
        const caixa = marcas.nth(i);
        const b = await caixa.boundingBox();
        if (!b || b.y + b.height < 0 || b.y > (page.viewportSize()!.height)) continue; // fora da tela
        if (b.y + b.height <= topo) continue; // acima da barra
        const coberto = await caixa.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const alvo = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return !!alvo && !el.contains(alvo) && !el.closest("label")?.contains(alvo);
        });
        expect(coberto, `caixinha ${i} coberta pela barra`).toBe(false);
      }
    });
  });
}
