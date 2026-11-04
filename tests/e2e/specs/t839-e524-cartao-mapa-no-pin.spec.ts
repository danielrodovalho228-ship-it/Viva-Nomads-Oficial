import { test, expect, type Page } from "@playwright/test";

/*
  T839 — E524 (D10, QA de cliques do morador 02/11): o cartão do pin no mapa da busca abre ancorado no pin, inteiro
  dentro do mapa, sem cobrir os botões de zoom, com o "Fechar" clicável — e Esc fecha. Todos os pins, 1280 e 390.
  (O clique vai direto no pin, por evento: a sobreposição de pins é o E525.)
*/
const SAIDA = "tests/laboratorio/saida";

async function abrirMapa(page: Page, largura: number) {
  await page.goto("/buscar", { waitUntil: "networkidle" });
  if (largura < 1024) {
    const botao = page.getByRole("button", { name: /mapa/i }).first();
    if (await botao.isVisible().catch(() => false)) await botao.click();
  }
  await expect(page.getByTestId("mapa-busca")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("pin-mapa").first()).toBeAttached({ timeout: 20_000 });
}

for (const largura of [1280, 390] as const) {
  test.describe(`T839 — E524 (${largura}px)`, () => {
    test.use({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });

    test("cada pin: cartão dentro do mapa, longe do zoom, Fechar clicável e Esc fecha", async ({ page }) => {
      test.setTimeout(180_000);
      await abrirMapa(page, largura);
      const total = await page.getByTestId("pin-mapa").count();
      expect(total).toBeGreaterThan(0);
      for (let i = 0; i < total; i++) {
        const pin = page.getByTestId("pin-mapa").nth(i);
        const rotulo = (await pin.textContent())?.trim();
        await pin.scrollIntoViewIfNeeded();
        await pin.dispatchEvent("click");
        const card = page.getByTestId("card-pin-mapa");
        await expect(card, `${rotulo}: abre`).toBeVisible();
        // Espera o mapa terminar de se mover para o cartão caber.
        await expect
          .poll(
            () =>
              page.evaluate(() => {
                const c = document.querySelector('[data-testid="card-pin-mapa"]')!.getBoundingClientRect();
                const m = document.querySelector('[data-testid="mapa-busca"]')!.getBoundingClientRect();
                return c.left >= m.left && c.right <= m.right && c.top >= m.top && c.bottom <= m.bottom;
              }),
            { timeout: 5_000, message: `${rotulo}: cartão inteiro dentro do mapa` }
          )
          .toBe(true);
        // E depois a página rolar (celular) para o cartão aparecer entre as barras fixas.
        const medir = () => page.evaluate(() => {
          const caixa = (s: string) => document.querySelector(s)?.getBoundingClientRect() ?? null;
          const c = caixa('[data-testid="card-pin-mapa"]')!;
          const z = caixa(".leaflet-control-zoom, .mapboxgl-ctrl-group");
          const f = caixa('[data-testid="card-pin-mapa"] button[aria-label="Fechar"]')!;
          const noPonto = document.elementFromPoint(f.left + f.width / 2, f.top + f.height / 2);
          const sobre = !!z && !(c.right <= z.left || c.left >= z.right || c.bottom <= z.top || c.top >= z.bottom);
          return { cobreZoom: sobre, fecharClicavel: !!noPonto?.closest('button[aria-label="Fechar"]') };
        });
        // O mapa anda em animação até o cartão caber: espera o estado final (Fechar clicável e nada sob o zoom).
        await expect
          .poll(medir, { timeout: 6_000, message: `${rotulo}: Fechar recebe o clique e o cartão não cobre o zoom` })
          .toEqual({ cobreZoom: false, fecharClicavel: true });
        await page.keyboard.press("Escape");
        await expect(card, `${rotulo}: Esc fecha`).toHaveCount(0);
      }
      // O Fechar também fecha (o último pin).
      await page.getByTestId("pin-mapa").last().dispatchEvent("click");
      await page.getByTestId("card-pin-mapa").getByRole("button", { name: "Fechar" }).click();
      await expect(page.getByTestId("card-pin-mapa")).toHaveCount(0);
      expect(await page.evaluate((l) => document.documentElement.scrollWidth - l, largura)).toBeLessThanOrEqual(1);
      await page.getByTestId("mapa-busca").screenshot({ path: `${SAIDA}/t839-mapa-${largura}.png` });
    });
  });
}
