import { test, expect } from "@playwright/test";

/*
  T2065 — E946 (Pista 3; autorizado pelo Gerente em 17/11, ronda 02:55Z) @E946 @ao-vivo-seguro
  Regra decidida (item do Daniel, 15/11; correção no draft #3834): na barra de filtros da /buscar a ordem dos chips é
  Datas · Local · Tipo · Preço · Mais filtros · Ordenar · Mapa · Nível — o Nível por ÚLTIMO, nunca órfão a meio da
  barra. A barra segue presa e SEM deslize lateral (E780). Guarda do item: 390 px. A ordem é a de leitura (de cima
  para baixo, da esquerda para a direita), medida na tela. Trava: vermelha na main até a correção entrar.
  Visitante, só leitura.
*/
test.use({ storageState: { cookies: [], origins: [] } });

const ORDEM = ["datas", "local", "tipo", "preco", "mais", "ordenar", "mapa", "nivel"];

test("T2065 — E946: a 390 px os chips da busca seguem a ordem com o Nível por último, sem deslize lateral @E946 @ao-vivo-seguro", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  const r = await page.goto("/buscar?local=Uberl%C3%A2ndia", { waitUntil: "domcontentloaded" });
  expect(r?.status()).toBe(200);
  const barra = page.getByTestId("linha-pilulas");
  await expect(barra).toBeVisible({ timeout: 30_000 });
  // O Nível só existe quando há nível para escolher (E452); nos dados de exemplo há.
  await expect(barra.getByTestId("pilula-nivel")).toBeVisible({ timeout: 30_000 });

  const chips = await barra.locator('[data-testid^="pilula-"]').evaluateAll((els) =>
    els
      .map((e) => ({ id: (e as HTMLElement).dataset.testid!.replace(/^pilula-/, ""), r: e.getBoundingClientRect() }))
      .filter((c) => c.r.width > 0 && c.r.height > 0)
      .map((c) => ({ id: c.id, x: c.r.left, y: c.r.top, direita: c.r.right })),
  );
  const daBarra = chips.filter((c) => ORDEM.includes(c.id));
  // Ordem de leitura: linhas pela altura (tolerância de meia altura de chip), dentro da linha da esquerda para a direita.
  const leitura = [...daBarra].sort((a, b) => (Math.abs(a.y - b.y) > 12 ? a.y - b.y : a.x - b.x)).map((c) => c.id);
  expect(leitura, "ordem dos chips na tela").toEqual(ORDEM);
  expect(leitura.at(-1), "o Nível é o último chip da barra").toBe("nivel");

  for (const c of daBarra) {
    expect(c.x, `${c.id}: começa dentro da tela`).toBeGreaterThanOrEqual(0);
    expect(c.direita, `${c.id}: termina dentro da tela`).toBeLessThanOrEqual(390);
  }
  const deslizeBarra = await barra.evaluate((b) => b.scrollWidth - b.clientWidth);
  expect(deslizeBarra, `a barra desliza ${deslizeBarra} px de lado`).toBeLessThanOrEqual(0);
  const lateral = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(lateral, `/buscar rola ${lateral} px de lado`).toBeLessThanOrEqual(0);
});
