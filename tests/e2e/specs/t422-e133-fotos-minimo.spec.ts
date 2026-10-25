import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";
import { abrirPasso, continuarFicaEm, prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T422 — E133 (levantamento do Daniel, 25/10; correção na Pista A). Passo 2, Fotos:
   1. abaixo de 8 fotos o "Continuar" não avança e diz que o mínimo é 8;
   2. com 8 fotos o "Continuar" avança para o Endereço (controle);
   3. a foto marcada como "não parece imóvel" não vira a foto principal — sem como reproduzir hoje (ver o fixme).
  Só no laboratório.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t422.${sufixo}@lab.vivanomads.test`, nome: "Fabia Fotos", role: "owner" as const };
const ids: { dono?: string; com3?: string; com8?: string } = {};

test.describe("T422 — E133: mínimo de 8 fotos no Passo 2", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.com3 = await prepararRascunho(ids.dono, `Studio 3 fotos ${sufixo}`, {}, 3);
    ids.com8 = await prepararRascunho(ids.dono, `Studio 8 fotos ${sufixo}`, {}, 8);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("1. com 3 fotos, o Continuar não avança e diz que o mínimo é 8", async ({ browser }) => {
    // E133 (Pista A): hoje o Passo 2 só exige 1 foto para avançar (validarEtapa em imoveis/novo/page.tsx); com 3 fotos
    // o Continuar leva ao Endereço (lab-crítico do #1367, run 40190394864). Quem corrigir tira este test.fail.
    test.fail(true, "E133: com menos de 8 fotos o Continuar do Passo 2 avança");
    const page = await abrirPasso(browser, { email: dono.email, senha }, ids.com3!, "fotos");
    await expect(page.getByTestId("fotos-contagem")).toContainText("3 / 8 fotos", { timeout: 20_000 });
    await page.getByTestId("cadastro-continuar").click();
    await page.waitForTimeout(500);
    await noPasso(page, "fotos");
    await expect(page.getByTestId("etapa-fotos").getByRole("alert").filter({ hasText: /8/ })).toBeVisible();
    await page.context().close();
  });

  test("2. com 8 fotos, o Continuar avança para o Endereço", async ({ browser }) => {
    const page = await abrirPasso(browser, { email: dono.email, senha }, ids.com8!, "fotos");
    await expect(page.getByTestId("fotos-contagem")).toContainText("8 / 8 fotos", { timeout: 20_000 });
    await continuarFicaEm(page, "endereco");
    await page.context().close();
  });

  test("3. a foto marcada como 'não parece imóvel' não vira a principal", async () => {
    // Não dá para reproduzir no laboratório hoje: o produto não tem veredito "não parece imóvel" POR FOTO (a análise
    // das fotos responde `ehImovel` para o conjunto, em src/lib/ai/fotos-prompt.ts) e o laboratório devolve sempre a
    // mesma resposta fixa (SUGESTAO_LAB_BRUTA). Quando a Pista A criar a marca por foto, este caso ganha o corpo.
    test.fixme(true, "E133 · 2: sem marca 'não parece imóvel' por foto no produto nem no simulador do laboratório");
  });
});
