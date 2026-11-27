import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirPortaoDaIdentidade } from "../fixtures/fechamento-identidade";

/*
  T1719 — E1082 @E1082 (ORDEM-DUET-392): o passo Garantia do Fechamento diz a regra decidida da caução.
  A prova ao vivo de 21/11 fechou a frase na página do imóvel (E1076) e achou o Fechamento ainda com a regra antiga:
  "Caução por bloco (50% do 1º bloco)", "X% do valor do período, no máximo 3 aluguéis".
  Estadia de 31 dias a R$ 2.500 por mês (a caução é R$ 1.292; o teto, R$ 7.500).
   1. Passo Garantia, a 390 e a 1280 px: o título e a explicação do bloco da caução e a linha "Quanto o morador paga"
      de "Sua proteção" dizem "50% do aluguel da estadia, no máximo 3 vezes o valor mensal"; a regra antiga saiu.
   2. Passo do contrato: a linha da caução no quadro "antes da entrada" diz a mesma regra e continua "devolvida no fim".
  As procuras são pelo texto que a tela mostra. Não confere rolagem lateral (ver a nota no caso 1).
  Laboratório; não é prova ao vivo no site.
*/
const SAIDA = "tests/laboratorio/saida";
const REGRA = "50% do aluguel da estadia, no máximo 3 vezes o valor mensal";
const REGRA_ANTIGA = /Caução por bloco|% do 1º bloco\)|do valor do período, no máximo 3 aluguéis|do período, no máximo 3 aluguéis|% do período, antes da entrada/;
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1719.${sufixo}@lab.vivanomads.test`, nome: "Dora Garantia Sobrenome", role: "owner" as const };
const inq = { email: `inq.t1719.${sufixo}@lab.vivanomads.test`, nome: "Iris Garantia Sobrenome", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; lead?: string } = {};

const emDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const continuar = (page: Page) => page.getByRole("button", { name: /continuar/i });

/** Abre o Fechamento da candidatura e chega ao passo Garantia. */
async function naGarantia(browser: Browser, largura: 390 | 1280): Promise<Page> {
  const page = await entrar(browser, dono.email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  await page.goto(`/dashboard/fechamento?c=${ids.lead}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Candidatura e verificação" })).toBeVisible({ timeout: 30_000 });
  await abrirPortaoDaIdentidade(page);
  await expect(continuar(page)).toBeEnabled({ timeout: 20_000 });
  await continuar(page).click();
  await expect(page.getByTestId("sua-protecao")).toBeVisible({ timeout: 15_000 });
  return page;
}

test.describe("T1719 — E1082: a Garantia do Fechamento diz '50% do aluguel da estadia' @E1082", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    // Contas de teste: a verificação é a simulada e o contrato sai no modo TESTE.
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    ids.imovel = await criarImovelPronto(ids.dono, `[TESTE QA] Studio garantia ${sufixo}`, { ativo: true, preco: 2500 });
    const { error: e1 } = await adm()
      .from("properties")
      .update({ condo_fee: 0, utilities_mode: "fixed", utilities_estimate: 300, prep_fee: 250, checkout_cleaning_enabled: false, checkout_cleaning_fee: 0, limpeza_estadia: null, min_period_days: 30, max_period_days: 180 })
      .eq("id", ids.imovel);
    if (e1) throw e1;
    const { data, error } = await adm()
      .from("leads")
      .insert({ owner_id: ids.dono, tenant_id: ids.inq, property_id: ids.imovel, status: "accepted", inicio_desejado: emDias(30), fim_desejado: emDias(61) })
      .select("id")
      .single();
    if (error) throw error;
    ids.lead = data.id as string;
    for (const tipo of ["identidade", "vinculo"]) {
      const u = () => crypto.randomUUID();
      const { error: e2 } = await adm().from("documentos_inquilino").insert({ lead_id: ids.lead, tenant_id: ids.inq, tipo, caminho: `${u()}/${u()}/${u()}.pdf`, hash_sha256: "a".repeat(64) });
      if (e2) throw e2;
    }
  });

  test.afterAll(async () => {
    if (ids.lead) {
      await adm().from("cobrancas_fechamento").delete().eq("lead_id", ids.lead);
      await adm().from("contratos").delete().eq("lead_id", ids.lead);
    }
    if (ids.imovel) await adm().from("messages").delete().eq("property_id", ids.imovel);
    await adm().from("tenant_verifications").delete().in("tenant_id", [ids.dono, ids.inq].filter(Boolean) as string[]);
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const largura of [390, 1280] as const) {
    test(`1. passo Garantia a ${largura} px: a regra decidida no bloco da caução e em 'Sua proteção'`, async ({ browser }) => {
      const page = await naGarantia(browser, largura);
      await page.getByRole("radio").and(page.locator(":not([disabled])")).first().click();
      await expect(page.getByTestId("garantia-caucao-titulo")).toHaveText("Caução (50% do aluguel da estadia)");
      await expect(page.getByTestId("garantia-caucao-regra")).toContainText(`A caução é de ${REGRA}.`);
      const protecao = page.getByTestId("sua-protecao");
      await expect(protecao).toContainText(/R\$\s?1\.292 depositados na entrada \(50% do aluguel da estadia, no máximo 3 vezes o valor mensal, que são R\$\s?7\.500\)/);
      await expect(page.locator("main"), "a regra antiga saiu do passo").not.toContainText(REGRA_ANTIGA);
      // Esta trava NÃO confere rolagem lateral: a 390 px este passo já tem 59 px de rolagem lateral na main (medido em
      // 22/11 na main c3de3c3c: largura de rolagem 449 contra 390), antes e depois do E1082. É defeito à parte, reportado.
      await page.getByTestId("garantia-caucao-titulo").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t1719-1-garantia-${largura}.png` });
      await page.context().close();
    });
  }

  test("2. passo do contrato: a linha da caução diz a mesma regra e continua 'devolvida no fim'", async ({ browser }) => {
    const page = await naGarantia(browser, 1280);
    await page.getByRole("radio").and(page.locator(":not([disabled])")).first().click();
    await page.getByTestId("ciente-protecao").check({ timeout: 15_000 });
    await continuar(page).click();
    await expect(page.getByRole("heading", { name: /serviços adicionais/i })).toBeVisible({ timeout: 15_000 });
    await continuar(page).click();
    await page.getByRole("button", { name: /Seguir sem seguro patrimonial/ }).click();
    await continuar(page).click();
    const linha = page.getByTestId("entrada-caucao");
    await expect(linha).toBeVisible({ timeout: 15_000 });
    await expect(linha).toContainText("Caução (50% do aluguel da estadia, antes da entrada) — devolvida no fim, conforme a conferência de saída");
    await expect(linha).toContainText(/R\$\s?1\.292/);
    await expect(linha).not.toContainText(REGRA_ANTIGA);
    await linha.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SAIDA}/t1719-2-contrato-caucao-1280.png` });
    await page.context().close();
  });
});
