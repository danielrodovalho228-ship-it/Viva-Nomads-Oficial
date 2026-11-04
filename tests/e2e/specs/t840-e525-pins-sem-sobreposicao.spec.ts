import { test, expect, type Page } from "@playwright/test";

/*
  T840 — E525 (D11, QA de cliques do morador 02/11): no mapa da busca nenhum pin cobre outro (R$ 2.430 sobre R$ 4.420,
  o aglomerado R$ 3.130/3.470/3.320) — também depois de dar zoom; nenhum pin afastado sai do mapa; com um cartão aberto,
  todo pin que não está por baixo dele recebe clique; e o título do cartão não corta com "…" à toa (até 2 linhas).
  1280 e 390.
*/
const SAIDA = "tests/laboratorio/saida";

async function abrirMapa(page: Page, largura: number) {
  await page.goto("/buscar", { waitUntil: "networkidle" });
  // O <html> do site tem rolagem suave: a rolagem do próprio Playwright antes do clique animaria e o pin "não para".
  await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });
  if (largura < 1024) {
    const botao = page.getByRole("button", { name: /mapa/i }).first();
    if (await botao.isVisible().catch(() => false)) await botao.click();
  }
  await expect(page.getByTestId("mapa-busca")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("pin-mapa").first()).toBeAttached({ timeout: 20_000 });
}

const medirPins = (page: Page) =>
  page.evaluate(() => {
    const m = document.querySelector('[data-testid="mapa-busca"]')!.getBoundingClientRect();
    const pins = [...document.querySelectorAll<HTMLElement>('[data-testid="pin-mapa"]')].map((e) => ({ t: e.textContent!.trim(), r: e.getBoundingClientRect() }));
    const sobre: string[] = [];
    for (let i = 0; i < pins.length; i++)
      for (let j = i + 1; j < pins.length; j++) {
        const a = pins[i].r, b = pins[j].r;
        if (!(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom)) sobre.push(`${pins[i].t}×${pins[j].t}`);
      }
    const foraDoMapa = pins.filter(({ r }) => r.left < m.left - 1 || r.right > m.right + 1).map((p) => p.t);
    return { sobre, foraDoMapa };
  });

for (const largura of [1280, 390] as const) {
  test.describe(`T840 — E525 (${largura}px)`, () => {
    test.use({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });

    test("pins sem sobreposição (também depois do zoom), dentro do mapa, clicáveis com cartão aberto; título inteiro", async ({ page }) => {
      test.setTimeout(120_000);
      await abrirMapa(page, largura);
      await expect.poll(() => medirPins(page), { timeout: 10_000 }).toEqual({ sobre: [], foraDoMapa: [] });
      await page.getByTestId("mapa-busca").screenshot({ path: `${SAIDA}/t840-pins-${largura}.png` });

      // Zoom para longe e de volta: o afastamento é refeito.
      for (const nome of ["Zoom out", "Zoom in"]) {
        await page.getByRole("button", { name: nome }).click();
        await page.waitForTimeout(600);
        await expect.poll(() => medirPins(page), { timeout: 10_000, message: `depois de ${nome}` }).toEqual({ sobre: [], foraDoMapa: [] });
      }

      // Cartão aberto: todo pin que não está por baixo dele recebe clique.
      await page.getByTestId("pin-mapa").first().dispatchEvent("click");
      const card = page.getByTestId("card-pin-mapa");
      await expect(card).toBeVisible();
      await page.waitForTimeout(1_200);
      const pins = await page.getByTestId("pin-mapa").all();
      for (const pin of pins.slice(1)) {
        await pin.scrollIntoViewIfNeeded();
        // Mede o cartão e o pin na mesma posição da página (a rolagem move os dois).
        const caixa = (await card.boundingBox())!;
        const r = await pin.boundingBox();
        if (!r) continue;
        const sobCartao = !(r.x + r.width <= caixa.x || r.x >= caixa.x + caixa.width || r.y + r.height <= caixa.y || r.y >= caixa.y + caixa.height);
        if (sobCartao) continue;
        await pin.click({ trial: true, timeout: 5_000 });
      }

      // Título do cartão: até 2 linhas, sem "…" para um título que cabe em duas.
      const titulo = card.locator("p").first();
      await expect(titulo).toHaveClass(/line-clamp-2/);
      await expect(titulo).toHaveAttribute("title", /.+/);
      const r = await titulo.evaluate((e) => ({ cortado: e.scrollHeight > e.clientHeight + 1, texto: e.textContent!.length }));
      if (r.texto <= 50) expect(r.cortado, "título de até 50 caracteres aparece inteiro").toBe(false);
    });
  });
}
