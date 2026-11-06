import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1236 — E631 (#2850), 05/11. Entrou só com teste de unidade. O perfil público do proprietário mostrava "0 imóveis na
  Viva" enquanto o cartão do anúncio do mesmo dono mostrava "10 imóveis na Viva": duas fontes. Agora o cartão conta o
  que a página lista (a mesma consulta da vitrine). Aqui, a 390 e 1280 px, um dono (conta comum) com 2 anúncios ativos e
  1 rascunho: o número do cartão em /imoveis/<id> e o da página /proprietario/<dono> são o MESMO, e o rascunho não conta.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1236.${sufixo}@lab.vivanomads.test`, nome: "Dora Dono", role: "owner" as const };
const ids: Record<string, string> = {};
const NA_VIVA = /(\d+) imóveis? na Viva/;

test.describe("T1236 — E631: o cartão do anúncio e o perfil do dono contam igual", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: false }).eq("id", ids.dono);
    ids.a = await criarImovelPronto(ids.dono, `Ativo A t1236 ${sufixo}`, { ativo: true, preco: 2900 });
    ids.b = await criarImovelPronto(ids.dono, `Ativo B t1236 ${sufixo}`, { ativo: true, preco: 3100 });
    ids.rascunho = await criarImovelPronto(ids.dono, `Rascunho t1236 ${sufixo}`, { semInternet: true, semConforto: true });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: "N imóveis na Viva" do cartão = o da página do dono`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
      try {
        const p = await ctx.newPage();
        await p.goto(`/imoveis/${ids.a}`, { waitUntil: "domcontentloaded" });
        const cartao = p.getByTestId("sobre-proprietario");
        await expect(cartao).toBeVisible({ timeout: 30_000 });
        const doCartao = (await cartao.innerText()).match(NA_VIVA);
        expect(doCartao, "o cartão do anúncio diz quantos imóveis o dono tem na Viva").not.toBeNull();

        await p.goto(`/proprietario/${ids.dono}`, { waitUntil: "domcontentloaded" });
        const naPagina = (await p.locator("main").innerText()).match(NA_VIVA);
        expect(naPagina, "a página do dono diz quantos imóveis ele tem na Viva").not.toBeNull();

        expect(doCartao![1]).toBe(naPagina![1]);
        // O rascunho não é público: no máximo os 2 ativos.
        expect(Number(naPagina![1])).toBeLessThanOrEqual(2);
        expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      } finally {
        await ctx.close();
      }
    });
  }
});
