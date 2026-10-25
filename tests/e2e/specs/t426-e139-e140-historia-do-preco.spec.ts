import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirPasso, prepararRascunho, reais } from "../fixtures/rascunho-cadastro";

/*
  T426 — E139/E140 (levantamento do Daniel, 25/10; correção na Pista A). Passo 8, Preço, com valor mensal R$ 3.000,
  condomínio R$ 300 e consumo fixo estimado R$ 200 (R$ 3.500/mês tudo incluído):
   1. a prévia "tudo incluído", o "Você recebe do morador" e a taxa contam a MESMA história: o que o morador paga é o
      total do mês com as contas × meses, e a taxa é sobre o valor do contrato (valor mensal × meses — condomínio e
      contas não entram na taxa, como no exemplo do próprio E139 e na regra do #1372);
   2. o comparador e o simulador usam o MESMO período (mudar os meses do simulador muda o do comparador). Desde o
      #1372 o comparador é o "Comparar com o Airbnb" do Preço sugerido (a linha do comparativo saiu).
  Só no laboratório.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t426.${sufixo}@lab.vivanomads.test`, nome: "Paula Preço", role: "owner" as const };
const ids: { dono?: string; rascunho?: string } = {};

async function lerTela(page: Page) {
  const previa = page.getByTestId("cadastro-tudo-incluido");
  await expect(previa).toBeVisible({ timeout: 20_000 });
  const total = reais(await previa.innerText());
  const meses = Number(await page.getByTestId("bolso-meses").inputValue());
  const recebe = reais(await page.getByTestId("bolso-recebe").innerText());
  const taxa = reais(await page.getByTestId("bolso-taxa").innerText());
  const pct = Number((await page.getByTestId("bolso-taxa-detalhe").innerText()).match(/(\d+(?:,\d+)?)%/)?.[1].replace(",", "."));
  return { total, meses, recebe, taxa, pct };
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
    // E139 corrigido no #1372 (Pista A): antes o simulador dizia "Você recebe do morador" R$ 12.000 em 4 meses, sem as
    // contas (run 40190394864); agora é o total do mês com as contas × meses. Sem test.fail desde a correção.
    const page = await abrirPasso(browser, { email: dono.email, senha }, ids.rascunho!, "preco");
    const t = await lerTela(page);
    console.log(`T426|total=${t.total}|meses=${t.meses}|recebe=${t.recebe}|taxa=${t.taxa}|pct=${t.pct}`);
    expect(t.total, "prévia: R$ 3.000 + R$ 300 + R$ 200").toBe(3500);
    expect(t.recebe, "'Você recebe do morador' = o total do mês com as contas × meses").toBe(t.total * t.meses);
    expect(t.taxa, "a taxa é sobre o valor do contrato: valor mensal (R$ 3.000) × meses").toBeCloseTo((t.pct / 100) * 3000 * t.meses, 0);
    await page.context().close();
  });

  test("2. o comparador e o simulador usam o mesmo período", async ({ browser }) => {
    const page = await abrirPasso(browser, { email: dono.email, senha }, ids.rascunho!, "preco");
    const antes = await lerTela(page);
    const comp = page.getByTestId("preco-sugerido");
    await comp.getByRole("button", { name: /Comparar com o Airbnb/ }).click();
    await expect(comp).toContainText(`pelos mesmos ${antes.meses} meses`);
    await page.getByTestId("bolso-meses").fill("6");
    await expect(comp).toContainText("pelos mesmos 6 meses");
    const depois = await lerTela(page);
    expect(depois.meses).toBe(6);
    expect(depois.taxa, "a taxa do simulador acompanha os 6 meses").toBeCloseTo((depois.pct / 100) * 3000 * 6, 0);
    await page.context().close();
  });

});
