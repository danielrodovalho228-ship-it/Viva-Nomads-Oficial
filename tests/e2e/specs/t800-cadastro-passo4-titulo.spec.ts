import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirPasso, prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T800 — conformidade do cadastro (Passo 4, mockup 04, 01/11, Pista A): "Características do imóvel" sobre o cartão dos
  números e o lembrete "Você pode revisar e editar depois, a qualquer momento." abaixo dele. 390 e 1280.
  E744 (tabela da Fable #3832, infra/tempo): conta e rascunho próprios, como os demais specs do assistente — com a conta
  compartilhada `proprietario` e `?etapa=detalhes`, a tela podia cair no Passo 1 com o aviso de rascunho. As asserções
  ficam iguais.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t800.${sufixo}@lab.vivanomads.test`, nome: "Diana Detalhes", role: "owner" as const };
const ids: { dono?: string; rascunho?: string } = {};

test.describe("T800 — Passo 4 com título e lembrete", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (conta e rascunho próprios).");
  test.describe.configure({ timeout: 120_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.rascunho = await prepararRascunho(ids.dono, `Studio t800 ${sufixo}`);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [390, 1280] as const) {
    test(`T800 — Passo 4 com título e lembrete (${largura} px)`, async ({ browser }) => {
      const page = await abrirPasso(browser, { email: dono.email, senha }, ids.rascunho!, "detalhes", largura);
      const cartao = page.getByTestId("cartao-numeros");
      await expect(cartao).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole("heading", { name: "Características do imóvel" })).toBeVisible();
      await expect(page.getByTestId("espaco-editar-depois")).toHaveText("Você pode revisar e editar depois, a qualquer momento.");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await page.screenshot({ path: `${SAIDA}/t800-passo4-${largura}.png` });
      await page.context().close();
    });
  }
});
