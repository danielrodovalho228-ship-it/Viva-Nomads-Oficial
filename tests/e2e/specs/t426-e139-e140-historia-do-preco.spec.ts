import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirPasso, prepararRascunho, reais } from "../fixtures/rascunho-cadastro";

/*
  T426 — E139/E140 (levantamento do Daniel, 25/10; correção na Pista A). Passo 8, Preço, com valor mensal R$ 3.000,
  condomínio R$ 300 e consumo fixo estimado R$ 200 (R$ 3.500/mês tudo incluído):
   1. a prévia "tudo incluído", o "Você recebe do morador" e a taxa contam a MESMA história: o que o morador paga é o
      total do mês com as contas × meses, e a taxa é sobre esse valor total do contrato;
   2. o comparativo e o simulador usam o MESMO período (mudar os meses do simulador muda o do comparativo) e a mesma
      taxa.
  Só no laboratório.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t426.${sufixo}@lab.vivanomads.test`, nome: "Paula Preço", role: "owner" as const };
const ids: { dono?: string; rascunho?: string } = {};

async function lerTela(page: Page) {
  const etapa = page.getByTestId("etapa-preco");
  const previa = etapa.getByText("Prévia — o morador vê").locator("xpath=..");
  await expect(previa).toBeVisible({ timeout: 20_000 });
  const total = reais(await previa.innerText());
  const meses = Number(await page.getByTestId("bolso-meses").inputValue());
  const recebe = reais(await page.getByTestId("bolso-recebe").innerText());
  const taxa = reais(await page.getByTestId("bolso-taxa").innerText());
  const pct = Number((await page.getByTestId("bolso-taxa-detalhe").innerText()).match(/(\d+(?:,\d+)?)%/)?.[1].replace(",", "."));
  const comparativo = await page.getByTestId("linha-comparativo").innerText();
  return { total, meses, recebe, taxa, pct, comparativo };
}

test.describe("T426 — E139/E140: Passo 8, a prévia, o 'você recebe' e a taxa", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.rascunho = await prepararRascunho(ids.dono, `Studio do preço ${sufixo}`, {
      monthlyPrice: "3000",
      condoFee: "300",
      utilitiesMode: "fixed",
      utilitiesEstimate: 200,
    });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("1. a prévia tudo incluído, o 'você recebe do morador' e a taxa contam a mesma história", async ({ browser }) => {
    // E139/E140 (Pista A): a prévia mostra R$ 3.500/mês tudo incluído, mas o simulador diz "Você recebe do morador"
    // R$ 12.000 em 4 meses (só o valor mensal × meses, sem as contas) e a taxa R$ 1.440 (12% sobre R$ 3.000 × 4), não
    // sobre o total do contrato (run 40190394864). Quem corrigir tira este test.fail.
    test.fail(true, "E139/E140: a prévia tudo incluído, o 'você recebe' e a taxa não contam a mesma história");
    const page = await abrirPasso(browser, { email: dono.email, senha }, ids.rascunho!, "preco");
    const t = await lerTela(page);
    console.log(`T426|total=${t.total}|meses=${t.meses}|recebe=${t.recebe}|taxa=${t.taxa}|pct=${t.pct}`);
    expect(t.total, "prévia: R$ 3.000 + R$ 300 + R$ 200").toBe(3500);
    expect(t.recebe, "'Você recebe do morador' = o total do mês com as contas × meses").toBe(t.total * t.meses);
    expect(t.taxa, "a taxa é sobre o valor total do contrato").toBeCloseTo((t.pct / 100) * t.total * t.meses, 0);
    await page.context().close();
  });

  test("2. o comparativo e o simulador usam o mesmo período e a mesma taxa", async ({ browser }) => {
    const page = await abrirPasso(browser, { email: dono.email, senha }, ids.rascunho!, "preco");
    const antes = await lerTela(page);
    expect(antes.comparativo).toContain(`${antes.meses} meses`);
    await page.getByTestId("bolso-meses").fill("6");
    await expect(page.getByTestId("linha-comparativo")).toContainText("Num contrato de 6 meses");
    const depois = await lerTela(page);
    expect(depois.meses).toBe(6);
    expect(reais(depois.comparativo.split("taxa de serviço é de")[1] ?? ""), "a taxa do comparativo = a do simulador").toBe(depois.taxa);
    await page.context().close();
  });
});
