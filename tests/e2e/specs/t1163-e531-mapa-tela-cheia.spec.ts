import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1163 — E531 (#2638, 05/11): no mapa em tela cheia do anúncio, a legenda "Área aproximada de …" sobe para o topo, ao
 * lado do Fechar — no rodapé ela cobria a atribuição do mapa (canto inferior direito, obrigatória; só "CARTO" aparecia).
 * O E531 entrou só com teste de unidade; aqui é a tela, 390 e 1280, com um anúncio com coordenadas:
 *   1. "Ampliar mapa" abre o mapa em tela cheia com a legenda (mapa-tela-cheia-legenda);
 *   2. a legenda NÃO se sobrepõe à atribuição (.leaflet-control-attribution) nem ao botão Fechar;
 *   3. a atribuição está à vista de verdade: o ponto do meio dela é dela (nada por cima).
 * Sem base de mapa no ambiente (mapaSemBase), não há "Ampliar mapa" por desenho (varredura 01/11) — o teste pula.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1163.${sufixo}@lab.vivanomads.test`, nome: "Mara Mapa", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};

type Caixa = { x: number; y: number; width: number; height: number };
const cruza = (a: Caixa, b: Caixa) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test.describe("T1163 — E531: no mapa em tela cheia, a legenda não cobre a atribuição", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio do mapa ${sufixo}`, { ativo: true });
    const { error } = await adm().from("properties").update({ lat: -18.919, lng: -48.277, address: "Centro" }) /* o bairro do anúncio sai de address */.eq("id", ids.imovel);
    expect(error, error?.message).toBeNull();
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`legenda no topo, atribuição à vista (${w})`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      try {
        await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
        await page.locator("#localizacao-title").scrollIntoViewIfNeeded();
        const ampliar = page.getByTestId("ampliar-mapa");
        await page.waitForTimeout(1_500);
        test.skip((await ampliar.count()) === 0, "sem base de mapa neste ambiente (mapaSemBase): não há 'Ampliar mapa' por desenho");
        await ampliar.click();

        const cheio = page.getByTestId("mapa-tela-cheia");
        await expect(cheio).toBeVisible({ timeout: 15_000 });
        const legenda = cheio.getByTestId("mapa-tela-cheia-legenda");
        await expect(legenda).toBeVisible();
        await expect(legenda).toContainText("Área aproximada de Centro");
        const atrib = cheio.locator(".leaflet-control-attribution").first();
        await expect(atrib).toBeVisible({ timeout: 15_000 });

        const bLeg = (await legenda.boundingBox())!;
        const bAtr = (await atrib.boundingBox())!;
        const bFechar = (await cheio.getByRole("button", { name: "Fechar mapa" }).boundingBox())!;
        expect(cruza(bLeg, bAtr), `legenda ${JSON.stringify(bLeg)} × atribuição ${JSON.stringify(bAtr)}`).toBe(false);
        expect(cruza(bLeg, bFechar), "legenda × Fechar").toBe(false);
        expect(bLeg.y, "a legenda fica na metade de cima").toBeLessThan((w === 390 ? 844 : 900) / 2);

        const doTopo = await atrib.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const topo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return !!topo && el.contains(topo);
        });
        expect(doTopo, "nada por cima da atribuição").toBe(true);
      } finally {
        await ctx.close();
      }
    });
  }
});
