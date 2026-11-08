import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1414 — E666 (#3087, na main): a legenda do calendário do anúncio diz as duas causas de um dia indisponível ("já
  reservado ou fechado pelo proprietário") e a nota explica o que fazer com outras datas. Visitante, 390 e 1280 px, sem
  estouro horizontal e sem texto cortado na legenda.
*/
const ROTULOS = ["Ocupado (já reservado)", "Bloqueado pelo proprietário"];
const NOTA_DATAS_LIVRES = "Dias na cor clara estão livres para pedir. Os demais, ocupados ou bloqueados, não estão disponíveis; para outras datas, pergunte ao proprietário antes de pedir.";
const senha = novaSenha();
const dono = { email: `dono.t1414.${novoSufixo()}@lab.vivanomads.test`, nome: "Cida Calendário", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};

test.describe("T1414 — E666: legenda do calendário", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio T1414 ${novoSufixo()}`, { ativo: true });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: legenda separa ocupado de bloqueado e a nota das outras datas`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390 });
      const p = await ctx.newPage();
      await p.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
      for (const rotulo of ROTULOS) {
        const legenda = p.getByText(rotulo).first();
        await expect(legenda).toBeVisible({ timeout: 30_000 });
        await legenda.scrollIntoViewIfNeeded();
        const caixa = await legenda.boundingBox();
        expect(caixa!.x).toBeGreaterThanOrEqual(0);
        expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(w);
      }
      await expect(p.getByText(NOTA_DATAS_LIVRES).first()).toBeVisible();
      expect(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await ctx.close();
    });
  }
});
