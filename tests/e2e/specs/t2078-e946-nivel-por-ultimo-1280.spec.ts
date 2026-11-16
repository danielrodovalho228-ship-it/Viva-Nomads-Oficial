import { test, expect } from "@playwright/test";

/*
  T2078 — E946 a 1280 px (Pista 3; autorizado pelo Gerente na ronda 04:55Z) @E946 @ao-vivo-seguro
  A companheira de computador do t2065 (390 px), para a trava não viver só no celular. Regra decidida (item do Daniel,
  15/11; correção no draft #3834): na barra de filtros da /buscar a ordem dos chips é Datas · Local · Tipo · Preço ·
  Mais filtros · Ordenar · Mapa · Nível — o Nível por ÚLTIMO; do tablet para cima a barra é UMA linha só (E82) e não
  desliza de lado (E780). A ordem é a de leitura, medida na tela. Trava: vermelha na main até a correção entrar.
  Visitante, só leitura.
*/
test.use({ storageState: { cookies: [], origins: [] } });

const ORDEM = ["datas", "local", "tipo", "preco", "mais", "ordenar", "mapa", "nivel"];
const LARGURA = 1280;

test("T2078 — E946: a 1280 px a barra da busca é uma linha só, termina no Nível e não desliza de lado @E946 @ao-vivo-seguro", async ({ page }) => {
  await page.setViewportSize({ width: LARGURA, height: 900 });
  const r = await page.goto("/buscar?local=Uberl%C3%A2ndia", { waitUntil: "domcontentloaded" });
  expect(r?.status()).toBe(200);
  const barra = page.getByTestId("linha-pilulas");
  await expect(barra).toBeVisible({ timeout: 30_000 });
  // O Nível só existe quando há nível para escolher (E452); nos dados de exemplo há.
  await expect(barra.getByTestId("pilula-nivel")).toBeVisible({ timeout: 30_000 });

  const chips = (
    await barra.locator('[data-testid^="pilula-"]').evaluateAll((els) =>
      els
        .map((e) => ({ id: (e as HTMLElement).dataset.testid!.replace(/^pilula-/, ""), r: e.getBoundingClientRect() }))
        .filter((c) => c.r.width > 0 && c.r.height > 0)
        .map((c) => ({ id: c.id, x: c.r.left, y: c.r.top, direita: c.r.right })),
    )
  ).filter((c) => ORDEM.includes(c.id));

  // Uma linha só: todos os chips na mesma altura (tolerância de meia altura de chip).
  const alturas = chips.map((c) => c.y);
  expect(Math.max(...alturas) - Math.min(...alturas), "do tablet para cima a barra é uma linha só").toBeLessThanOrEqual(12);
  const leitura = [...chips].sort((a, b) => a.x - b.x).map((c) => c.id);
  expect(leitura, "ordem dos chips na tela").toEqual(ORDEM);
  expect(leitura.at(-1), "o Nível é o último chip da barra").toBe("nivel");

  for (const c of chips) {
    expect(c.x, `${c.id}: começa dentro da tela`).toBeGreaterThanOrEqual(0);
    expect(c.direita, `${c.id}: termina dentro da tela`).toBeLessThanOrEqual(LARGURA);
  }
  const deslizeBarra = await barra.evaluate((b) => b.scrollWidth - b.clientWidth);
  expect(deslizeBarra, `a barra desliza ${deslizeBarra} px de lado`).toBeLessThanOrEqual(0);
  const lateral = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(lateral, `/buscar rola ${lateral} px de lado`).toBeLessThanOrEqual(0);
});
