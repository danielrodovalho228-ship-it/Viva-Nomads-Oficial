import { test, expect } from "@playwright/test";
import { preencherPeriodoDaProposta } from "../fixtures/periodo-proposta";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1174 — E584 (#2667, 05/11): o passo 1 do "Pedir para morar" nomeia o condomínio, as contas e a limpeza de preparação
 * em linhas PRÓPRIAS, com os rótulos do painel do anúncio — antes só ficavam dentro do total por mês ou da "Conta do
 * total". O E584 entrou só com teste de unidade; aqui é a tela, 390 e 1280, com um anúncio de condomínio R$ 350 e limpeza
 * de preparação R$ 300 (contas reais, sem estimativa):
 *   1. o passo 1 tem a linha "Condomínio" com R$ 350;
 *   2. e a linha "Limpeza de preparação — cobrada uma única vez" (ROTULO_PREPARACAO_PASSO1) com R$ 300;
 *   3. sem estouro horizontal.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1174.${sufixo}@lab.vivanomads.test`, nome: "Saulo Parcelas", role: "owner" as const };
const morador = { email: `inq.t1174.${sufixo}@lab.vivanomads.test`, nome: "Tânia Parcelas", role: "tenant" as const };
const ROTULO_PREPARACAO = "Limpeza de preparação — cobrada uma única vez"; // ROTULO_PREPARACAO_PASSO1 (src/lib/reserva-imovel.ts)
const ids: { dono?: string; morador?: string; imovel?: string } = {};

test.describe("T1174 — E584: o passo 1 do 'Pedir para morar' nomeia condomínio e limpeza de preparação", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio das parcelas ${sufixo}`, { ativo: true, preco: 2800 });
    const { error } = await adm().from("properties").update({ condo_fee: 350, utilities_mode: "real", prep_fee: 300, checkout_cleaning_enabled: false, limpeza_estadia: null }).eq("id", ids.imovel);
    expect(error, error?.message).toBeNull();
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.morador, ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`condomínio e limpeza de preparação em linhas próprias no passo 1 (${w})`, async ({ browser }) => {
      const p = await entrar(browser, morador.email, senha);
      try {
        await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
        await p.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
        const cartao = p.locator("#cartao-preco");
        // Abaixo de 1024 px o "Pedir para morar" mora na barra fixa (prompt 41, como na t181).
        const botao = w < 1024 ? p.getByTestId("barra-fixa-imovel").getByRole("button", { name: "Pedir para morar", exact: true }) : cartao.getByRole("button", { name: "Pedir para morar", exact: true });
        const passo = p.getByTestId("solicitacao-passo");
        await expect(async () => {
          await botao.click();
          await expect(passo).toBeVisible({ timeout: 3_000 });
        }).toPass({ timeout: 30_000 });
        await preencherPeriodoDaProposta(passo);

        const linha = (rotulo: string) => passo.locator("dl > div").filter({ has: p.locator("dt", { hasText: rotulo }) }).first();
        await expect(linha("Condomínio").locator("dd")).toHaveText(/R\$\s?350/, { timeout: 15_000 });
        await expect(linha(ROTULO_PREPARACAO).locator("dd")).toHaveText(/R\$\s?300/);
        expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await p.context().close();
      }
    });
  }
});
