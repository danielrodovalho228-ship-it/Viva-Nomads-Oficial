import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1177 — E494 (#2682, 05/11): no "Continue seu anúncio" do Início do dono, o passo que leva ao MESMO lugar do botão
 * "Continuar de onde parou" deixa de ser atalho — aparece só como estado (inicio-dono-passo-atual, sem link nem seta); os
 * outros passos seguem como atalho. O E494 entrou só com teste de unidade; aqui é a tela, 390 e 1280, com um rascunho do
 * dono SEM fotos e sem draft_data (o botão então leva ao primeiro item que falta, o mesmo de um dos passos):
 *   1. o bloco mostra o botão inicio-dono-botao e a lista inicio-dono-passos;
 *   2. nenhum link da lista vai ao mesmo endereço do botão;
 *   3. o passo do mesmo destino aparece como estado (inicio-dono-passo-atual);
 *   4. sem estouro horizontal.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1177.${sufixo}@lab.vivanomads.test`, nome: "Ivo Rascunho", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};

test.describe("T1177 — E494: o passo com o destino do botão não é atalho no 'Continue seu anúncio'", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Rascunho sem fotos ${sufixo}`);
    await adm().from("property_photos").delete().eq("property_id", ids.imovel);
    const { error } = await adm().from("properties").update({ photo_count: 0, draft_data: null }).eq("id", ids.imovel);
    expect(error, error?.message).toBeNull();
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`o passo do destino do botão é só estado; os links da lista vão a outros lugares (${w})`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390 });
      try {
        const p = await entrarNaPagina(await ctx.newPage(), dono.email, senha);
        await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
        const botao = p.getByTestId("inicio-dono-botao");
        await expect(botao).toBeVisible({ timeout: 30_000 });
        await expect(botao).toHaveText(/Continuar de onde parou/);
        const destino = await botao.getAttribute("href");
        expect(destino, "o botão tem destino").toBeTruthy();
        const passos = p.getByTestId("inicio-dono-passos");
        await expect(passos).toBeVisible();
        const hrefs = await passos.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
        expect(hrefs, `nenhum atalho repete o botão (${destino})`).not.toContain(destino);
        await expect(passos.getByTestId("inicio-dono-passo-atual"), "o passo do mesmo destino vira estado").toHaveCount(1);
        expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await ctx.close();
      }
    });
  }
});
