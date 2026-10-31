import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T767 — L-60 (#1673, Pista B): na /buscar com um destino, o imóvel sem ponto no mapa fica SEM a linha de distância. O
  defeito era o (0, 0) que o mapeamento da busca põe no lugar da coordenada nula virar "≈ 5.640,0 km em linha reta até
  …" (a t261 anotava L-60 nos imóveis da massa). Pista C, bloco 99. Pela tela de verdade, a 1280 e a 390 px, como
  visitante, com um destino em Uberlândia passado na URL (dlat/dlng/drot e modo=carro):
   - o imóvel semeado com ponto, perto do destino, tem a linha de distância, sem os milhares de km;
   - L-82 em test.fail (1280): o semeado sem ponto (lat/lng nulos) fica sem linha e nenhum cartão diz 1.000 km ou mais.
     Hoje o sem ponto ainda diz "≈ 5.668,8 km": o (0, 0) chega deslocado pela coordenada aproximada e escapa da trava
     do #1673, que só recusa o 0 exato.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const DESTINO = { lat: -18.919, lng: -48.277, rotulo: `Rua T767 ${sufixo}` };
const ids: { dono?: string; comPonto?: string; semPonto?: string } = {};
// Com o modo (como a t261 e as varreduras): sem ele a busca não desenha a linha de tempo/distância nos cartões.
const url = `/buscar?dlat=${DESTINO.lat}&dlng=${DESTINO.lng}&drot=${encodeURIComponent(DESTINO.rotulo)}&modo=carro`;

test.describe("T767 — L-60: imóvel sem ponto não ganha distância de milhares de km", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta({ email: `dono.t767.${sufixo}@lab.vivanomads.test`, nome: "Lia Distância", role: "owner" }, senha);
    ids.comPonto = await criarImovelPronto(ids.dono, `Studio com ponto T767 ${sufixo}`, { ativo: true, preco: 2400 });
    ids.semPonto = await criarImovelPronto(ids.dono, `Studio sem ponto T767 ${sufixo}`, { ativo: true, preco: 2400 });
    await adm().from("properties").update({ lat: DESTINO.lat + 0.004, lng: DESTINO.lng }).eq("id", ids.comPonto); // consistency-ignore: massa do laboratório
    await adm().from("properties").update({ lat: null, lng: null, lat_exata: null, lng_exata: null }).eq("id", ids.semPonto); // consistency-ignore: massa do laboratório
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  async function cartoes(browser: import("@playwright/test").Browser, largura: number): Promise<{ linhas: [string, string][]; fechar: () => Promise<void> }> {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("card-resultado").first()).toBeVisible({ timeout: 30_000 });
    // O destino da URL entra no estado depois da hidratação: espera a 1ª linha antes de ler os cartões (como a t261).
    await expect(page.getByTestId("tempo-cartao").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("tempo-cartao").filter({ hasText: "calculando…" })).toHaveCount(0, { timeout: 20_000 });
    const linhas = await page.getByTestId("card-resultado").evaluateAll((els) =>
      els.map((el) => [el.getAttribute("data-id") ?? "", el.querySelector('[data-testid="tempo-cartao"]')?.textContent?.trim() ?? ""] as [string, string]),
    );
    return { linhas, fechar: () => ctx.close() };
  }

  for (const largura of [1280, 390] as const) {
    test(`${largura} px: o imóvel com ponto tem a linha de distância, sem os milhares de km`, async ({ browser }) => {
      const { linhas, fechar } = await cartoes(browser, largura);
      const mapa = new Map(linhas);
      // O semeado com ponto, a ~450 m do destino, aparece com a linha (tempo de rota ou "em linha reta").
      expect(mapa.has(ids.comPonto!), "o imóvel com ponto aparece na busca com destino").toBe(true);
      expect(mapa.get(ids.comPonto!), "o imóvel com ponto tem a linha de distância").not.toBe("");
      expect(mapa.get(ids.comPonto!)).not.toMatch(/[\d.]{5,} km/);
      await fechar();
    });
  }

  test("1280 px: o imóvel sem ponto fica sem linha e nenhum cartão passa de 1.000 km (L-82)", async ({ browser }) => {
    // L-82 (bloco 99, lab-crítico 41203364871 e 41204210345): o L-60 continua. O mapeamento público troca a coordenada
    // nula por 0 (rowToProperty) e em seguida comCoordenadaAproximada desloca até ±0,00225° e arredonda a 3 casas: o
    // ponto chega ao cartão como (0,001; −0,002), nunca (0, 0) exato, e a trava do #1673 (distanciaAte recusa só o 0
    // exato) não pega. O próprio imóvel semeado sem ponto (lat, lng, lat_exata e lng_exata nulos) diz
    // "≈ 5.668,8 km em linha reta até …", e dezenas de cartões da massa também. Falha esperada até a correção.
    test.fail(true, "L-82: imóvel sem ponto ainda ganha '≈ 5.668 km' — o (0, 0) chega deslocado pela coordenada aproximada");
    const { linhas, fechar } = await cartoes(browser, 1280);
    await fechar();
    const mapa = new Map(linhas);
    if (mapa.has(ids.semPonto!)) expect(mapa.get(ids.semPonto!), "imóvel sem ponto sem linha de distância").toBe("");
    const longe = linhas.filter(([, t]) => /^≈ [\d.]+(,\d)? km/.test(t) && Number(t.match(/^≈ ([\d.]+)/)![1].replace(/\./g, "")) >= 1000);
    expect(longe, "cartões com distância de milhares de km").toEqual([]);
  });
});
