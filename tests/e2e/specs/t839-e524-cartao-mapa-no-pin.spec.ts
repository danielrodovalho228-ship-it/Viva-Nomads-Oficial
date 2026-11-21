import { test, expect, type Page } from "@playwright/test";

/*
  T839 — E524 (D10, QA de cliques do morador 02/11): o cartão do pin no mapa da busca abre ancorado no pin, inteiro
  dentro do mapa, sem cobrir os botões de zoom, com o "Fechar" clicável — e Esc fecha. Todos os pins, 1280 e 390.
  (O clique vai direto no pin, por evento: a sobreposição de pins é o E525.)
  E524/E988 (ORDEM-DUET-113, t839 com estouro de 180 s a 390 px): desde o E988 o pin que não cabe legível entra no "+N"
  de um vizinho e troca de testid (pin-mapa-agrupado) a cada movimento do mapa. O teste contava os pins uma vez e andava
  pelo índice; no celular o mapa anda para o cartão caber, mais pins se agrupam e o nth(i) deixava de existir (espera até
  estourar). Agora anda pelo id de cada pin da vista inicial e, se o da vez estiver agrupado depois de um movimento,
  volta à vista inicial antes de abri-lo. A regra cobrada é a mesma: todo pin da vista inicial abre o cartão dentro do mapa.
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

/*
  E1036 (ORDEM-DUET-196, sonda da Pista 3: t839 falha 3 de 3 a 390 px): entre conferir que o pin existe (count() 1) e o
  clique, o mapa ainda acaba de andar (o Esc do cartão anterior) e o E988 agrupa o pin — ele vira pin-mapa-agrupado e o
  dispatchEvent/textContent esperavam por ele até o teste estourar. Agora o clique tem timeout curto e, se o pin já não
  estiver lá, volta à vista inicial e tenta outra vez (até 3 vezes), como o laço já fazia com count() 0.
*/
const ESPERA_CLIQUE_MS = 3_000;
async function abrirCartaoDoPin(
  page: Page,
  largura: number,
  id: string,
  /** Só para a trava do E1036: corre uma vez entre a conferência e o clique (ali o mapa pode agrupar o pin). */
  entreConferenciaEClique?: () => Promise<void>
): Promise<string> {
  const seletor = `[data-testid="pin-mapa"][data-id="${id}"]`;
  for (let tentativa = 1; ; tentativa++) {
    const pin = page.locator(seletor);
    if ((await pin.count()) === 0) {
      // Agrupado depois de o mapa andar para o cartão anterior caber: volta à vista inicial, onde ele é um pin.
      await abrirMapa(page, largura);
      await expect(pin, `${id}: é pin visível na vista inicial`).toHaveCount(1, { timeout: 10_000 });
    }
    if (tentativa === 1 && entreConferenciaEClique) await entreConferenciaEClique();
    try {
      const texto = (await pin.textContent({ timeout: ESPERA_CLIQUE_MS }))?.trim();
      await pin.dispatchEvent("click", undefined, { timeout: ESPERA_CLIQUE_MS });
      await expect(page.getByTestId("card-pin-mapa")).toBeVisible({ timeout: ESPERA_CLIQUE_MS });
      return `${texto} (${id.slice(0, 8)})`;
    } catch (erro) {
      // O pin foi agrupado entre a conferência e o clique: recomeça da vista inicial.
      if (tentativa >= 3) throw erro;
      await abrirMapa(page, largura);
    }
  }
}

for (const largura of [1280, 390] as const) {
  test.describe(`T839 — E524 (${largura}px)`, () => {
    test.use({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });

    test("cada pin: cartão dentro do mapa, longe do zoom, Fechar clicável e Esc fecha", async ({ page }) => {
      test.setTimeout(180_000);
      await abrirMapa(page, largura);
      // Os pins visíveis na vista inicial, pelo id (o índice muda quando o mapa anda e o E988 agrupa pins).
      const ids = await page.getByTestId("pin-mapa").evaluateAll((els) => els.map((e) => e.getAttribute("data-id") ?? ""));
      expect(ids.length).toBeGreaterThan(0);
      expect(ids.every(Boolean), "todo pin tem data-id").toBe(true);
      for (const id of ids) {
        const rotulo = await abrirCartaoDoPin(page, largura, id);
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

/*
  E1036 — trava determinística (não depende de o mapa andar a tempo): o pin é agrupado exactamente entre a conferência
  e o clique, como o E988 faz (testid pin-mapa-agrupado, escondido, sem clique). Sem a correção o clique esperava pelo
  pin até o teste estourar; com ela, volta à vista inicial e abre o cartão do mesmo pin.
*/
test.describe("T839 — E1036 (390px): pin agrupado entre a conferência e o clique", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("o clique não fica à espera do pin agrupado: volta à vista inicial e abre o cartão", async ({ page }) => {
    test.setTimeout(60_000);
    await abrirMapa(page, 390);
    const id = (await page.getByTestId("pin-mapa").first().getAttribute("data-id")) ?? "";
    expect(id).not.toBe("");
    const rotulo = await abrirCartaoDoPin(page, 390, id, () =>
      page.evaluate((i) => {
        const el = document.querySelector<HTMLElement>(`[data-testid="pin-mapa"][data-id="${i}"]`)!;
        el.dataset.testid = "pin-mapa-agrupado";
        el.style.visibility = "hidden";
        el.style.pointerEvents = "none";
      }, id)
    );
    await expect(page.getByTestId("card-pin-mapa"), `${rotulo}: abre`).toBeVisible();
    await expect(page.getByTestId("card-pin-mapa")).toHaveAttribute("data-id", id);
  });
});
