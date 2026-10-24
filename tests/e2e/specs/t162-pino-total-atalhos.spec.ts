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
    // O "R$ X" do cartão (total do mês) — o "R$ Y em N meses" ao lado é o total da estadia (QA do Prompt 40).
    const total = brl(await cartao.getByTestId("cartao-preco-mes").innerText());
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
      // E82-A: sem chips de filtro ativo — nenhuma pílula com valor e "Mais filtros" sem "(N)".
      for (const id of ["datas", "local", "tipo", "preco", "nivel", "ordenar"]) await expect(page.getByTestId(`pilula-${id}`)).toHaveAttribute("data-valor", "");
      await expect(page.getByTestId("pilula-mais")).not.toContainText("(");
      await expect(page.getByTestId("card-resultado").first()).toBeVisible();
    });

    test("com itens marcados, nenhuma caixinha de comparar fica sob a barra fixa", async ({ page }) => {
      await page.goto("/buscar", { waitUntil: "networkidle" });
      const marcas = page.getByTestId("marcar-comparar");
      test.skip((await marcas.count()) < 1, "sem cartões");
      await marcas.first().check();
      const barra = page.getByTestId("barra-comparar").locator("> div");
      await expect(barra).toBeVisible();
      // a página ainda cresce (fotos/cartões carregando) logo após rolar: rola e confere de novo até estabilizar (instável no lab)
      await expect
        .poll(
          async () => {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(300);
            return page.evaluate(() => {
              const topo = document.querySelector('[data-testid="barra-comparar"] > div')?.getBoundingClientRect().top ?? window.innerHeight;
              const cobertas: number[] = [];
              document.querySelectorAll('[data-testid="marcar-comparar"]').forEach((el, i) => {
                const r = el.getBoundingClientRect();
                if (r.bottom < 0 || r.top > window.innerHeight || r.bottom <= topo) return; // fora da tela ou acima da barra
                const alvo = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
                if (alvo && !el.contains(alvo) && !el.closest("label")?.contains(alvo)) cobertas.push(i);
              });
              return cobertas;
            });
          },
          { timeout: 20_000, message: "caixinhas cobertas pela barra fixa" },
        )
        .toEqual([]);
    });
  });
}
