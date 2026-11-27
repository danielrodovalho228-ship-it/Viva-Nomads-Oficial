import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1789 — E1072 @E1072 (fatia 3; ORDEM-DUET-352; nasceu t1713 e foi renumerada na ORDEM-DUET-1094, porque a t1713 é a do
  E1075 na main): o quadro "1º pagamento" na estadia em DIAS.
  O contrato provado ao vivo em 20/11: 31 dias a R$ 2.500,00 por mês, contas de R$ 300,00 por mês e limpeza de
  preparação de R$ 250,00. O registro do bloco cobra R$ 3.143,33 (valor do bloco 2.583,33 + contas 310,00 + limpeza
  250,00); a proposta e o Fechamento diziam "1º pagamento R$ 3.050,00" (um mês cheio + a limpeza).
   1. O dono envia a proposta de 31 dias: o detalhe diz "1º pagamento R$ 3.143,33", com a conta por extenso.
   2. A interessada vê o mesmo número a 390 px e aceita.
   3. O Fechamento, na etapa do contrato: o quadro "O morador vê no 1º pagamento" fecha em R$ 3.143, com a mesma conta.
   4. (caso combinado E1141×#4084, ORDEM-DUET-1094) A estadia de 31 dias passa a ser a ANTERIOR: a mesma candidatura ganha
      uma proposta mais nova, de meses cheios, com contrato assinado (a forma da t1787). O assistente da estadia anterior
      (`?c=<candidatura>&p=<proposta de 31 dias>`, o E1141) abre com os valores DELA, e o quadro do 1º pagamento continua
      a ser o 1º bloco inteiro em dias (R$ 3.143,33, com a conta) — nunca o 1º pagamento da proposta nova.
  As procuras são pelo texto que a tela mostra. Capturas a 390 e a 1280 px. Laboratório; não é prova ao vivo no site.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1789.${sufixo}@lab.vivanomads.test`, nome: "Dora Quadro Sobrenome", role: "owner" as const };
const inq = { email: `inq.t1789.${sufixo}@lab.vivanomads.test`, nome: "Iris Quadro Sobrenome", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; lead?: string; proposta?: string } = {};

const emDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const ENTRADA = emDias(30);
const SAIDA_DATA = emDias(61); // 31 dias
const CONTA = "valor do bloco R$ 2.583,33 + contas do período R$ 310,00 + limpeza de preparação R$ 250,00 = R$ 3.143,33";
const semEspacoDuro = (t: string) => t.replace(/ /g, " ").replace(/\s+/g, " ");

async function abrir(page: Page, rota: string) {
  await page.goto(rota, { waitUntil: "domcontentloaded" });
  await page.locator("main").first().waitFor();
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}
/** A linha "1º pagamento" da proposta atual: o rótulo e o valor ao lado. */
const linhaDoPrimeiroPagamento = (page: Page) => page.getByText("1º pagamento", { exact: true }).first().locator("xpath=..");

test.describe("T1789 — E1072: o 1º pagamento na estadia em dias é o 1º bloco inteiro @E1072", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    ids.imovel = await criarImovelPronto(ids.dono, `[TESTE QA] Studio quadro ${sufixo}`, { ativo: true, preco: 2500 });
    const { error: e1 } = await adm()
      .from("properties")
      .update({ condo_fee: 0, utilities_mode: "fixed", utilities_estimate: 300, prep_fee: 250, checkout_cleaning_enabled: false, checkout_cleaning_fee: 0, limpeza_estadia: null, min_period_days: 30, max_period_days: 180 })
      .eq("id", ids.imovel);
    if (e1) throw e1;
    const { data, error } = await adm()
      .from("leads")
      .insert({ owner_id: ids.dono, tenant_id: ids.inq, property_id: ids.imovel, status: "new", inicio_desejado: ENTRADA, fim_desejado: SAIDA_DATA })
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
      await adm().from("propostas").delete().eq("lead_id", ids.lead);
    }
    if (ids.imovel) await adm().from("messages").delete().eq("property_id", ids.imovel);
    await apagarContas([ids.dono, ids.inq]);
  });

  test("1. a proposta de 31 dias diz '1º pagamento R$ 3.143,33', com a conta por extenso", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await abrir(page, `/dashboard/orcamentos/nova?interessado=${ids.lead}`);
    await expect(page.getByRole("button", { name: /enviar proposta/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("main")).toContainText("31 dias");
    await page.getByRole("button", { name: /enviar proposta/i }).click();
    await page.waitForURL(/\/dashboard\/propostas\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    ids.proposta = page.url().split("/").pop()!;

    const { data: v } = await adm().from("proposta_versoes").select("dias, total_contrato").eq("proposta_id", ids.proposta).eq("versao", 1).single();
    expect(Number(v!.dias), "a massa é a do contrato provado: 31 dias").toBe(31);
    expect(Number(v!.total_contrato)).toBeCloseTo(3143.33, 2);

    const linha = linhaDoPrimeiroPagamento(page);
    await expect(linha, "o 1º pagamento é o 1º bloco inteiro, não um mês cheio + a limpeza").toContainText(/R\$\s?3\.143,33/, { timeout: 20_000 });
    await expect(linha).not.toContainText(/3\.050/);
    expect(semEspacoDuro(await page.locator("main").innerText()), "a conta do 1º bloco por extenso").toContain(CONTA);
    await linha.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SAIDA}/t1789-1-proposta-dono-1280.png` });
    await page.context().close();
  });

  test("2. a interessada vê o mesmo 1º pagamento a 390 px e aceita", async ({ browser }) => {
    const pi = await entrar(browser, inq.email, senha);
    await pi.setViewportSize({ width: 390, height: 844 });
    await abrir(pi, `/dashboard/propostas/${ids.proposta}`);
    const linha = linhaDoPrimeiroPagamento(pi);
    await expect(linha).toContainText(/R\$\s?3\.143,33/, { timeout: 20_000 });
    expect(semEspacoDuro(await pi.locator("main").innerText())).toContain(CONTA);
    await linha.scrollIntoViewIfNeeded();
    expect(await pi.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), "390 px: sem rolagem lateral").toBeLessThanOrEqual(1);
    await pi.screenshot({ path: `${SAIDA}/t1789-2-proposta-interessada-390.png` });
    await pi.getByRole("button", { name: /^Aceitar/ }).first().click();
    await expect.poll(async () => (await adm().from("propostas").select("status").eq("id", ids.proposta!).single()).data?.status, { timeout: 20_000 }).toBe("aceita");
    await pi.context().close();
  });

  test("3. o Fechamento: o quadro 'O morador vê no 1º pagamento' fecha em R$ 3.143, com a mesma conta", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await abrir(page, `/dashboard/fechamento?c=${ids.lead}`);
    await expect(page.getByRole("heading", { name: "Candidatura e verificação" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /verificar identidade/i }).click();
    const continuar = page.getByRole("button", { name: /continuar/i });
    await expect(continuar).toBeEnabled({ timeout: 20_000 });
    await continuar.click();
    await page.getByRole("radio").and(page.locator(":not([disabled])")).first().click();
    await page.getByTestId("ciente-protecao").check({ timeout: 15_000 });
    await continuar.click();
    await expect(page.getByRole("heading", { name: /serviços adicionais/i })).toBeVisible({ timeout: 15_000 });
    await continuar.click();
    await page.getByRole("button", { name: /Seguir sem seguro patrimonial/ }).click();
    await continuar.click();

    const quadro = page.getByText("O morador vê no 1º pagamento", { exact: true }).locator("xpath=..");
    await expect(quadro).toBeVisible({ timeout: 15_000 });
    const total = quadro.getByText("1º pagamento", { exact: true }).locator("xpath=..");
    await expect(total, "o quadro fecha no 1º bloco inteiro").toContainText(/R\$\s?3\.143(?!\d)/);
    await expect(total).not.toContainText(/3\.050/);
    expect(semEspacoDuro(await quadro.innerText()), "a conta do 1º bloco por extenso").toContain(CONTA);
    for (const largura of [1280, 390] as const) {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await total.scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${largura} px: sem rolagem lateral`).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `${SAIDA}/t1789-3-fechamento-quadro-${largura}.png` });
    }
    await page.context().close();
  });

  test("4. caso combinado E1141×#4084: o assistente da estadia ANTERIOR mostra o 1º pagamento em dias DELA", async ({ browser }) => {
    // A forma da t1787: a proposta de 31 dias fica "em contrato" sem contrato; uma proposta mais nova, de 2 meses cheios
    // a R$ 4.000,00, tem o contrato assinado. Sem p, o fechamento abriria a mais nova.
    const { error: eAntiga } = await adm().from("propostas").update({ status: "em_contrato" }).eq("id", ids.proposta!);
    if (eAntiga) throw eAntiga;
    const { data: antiga } = await adm().from("propostas").select("numero").eq("id", ids.proposta!).single();
    const { data: numero } = await adm().rpc("next_document_number", { p_type: "orcamento", p_year: new Date().getFullYear() });
    const agora = new Date().toISOString();
    const { data: nova, error: eNova } = await adm()
      .from("propostas")
      .insert({ numero, lead_id: ids.lead, property_id: ids.imovel, owner_id: ids.dono, tenant_id: ids.inq, status: "contrato_assinado", versao_atual: 1, validade_dias: 7, valida_ate: `${emDias(7)}T23:00:00Z`, aceita_em: agora })
      .select("id, numero")
      .single();
    if (eNova) throw eNova;
    const { error: eVersao } = await adm().from("proposta_versoes").insert({
      proposta_id: nova.id, versao: 1, autor: "owner", valor_base: 4000, valor_mensal: 4000, meses: 2, data_entrada: emDias(120), total_mensal: 4000, total_contrato: 8000, mensagem: "Proposta nova da t1789 (caso 4).",
    });
    if (eVersao) throw eVersao;
    const { error: eContrato } = await adm()
      .from("contratos")
      .insert({ lead_id: ids.lead, property_id: ids.imovel, tenant_id: ids.inq, proposta_id: nova.id, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: 60, aluguel_mensal: 4000, tamanho_bloco_meses: 2, comissao_percent: 0.12, comissao_valor: 960, qtd_ocupantes: 1, garantia: "caucao", status: "ativo", periodo: `[${emDias(120)},${emDias(179)}]`, created_at: agora, assinado_proprietario_em: agora, assinado_inquilino_em: agora });
    if (eContrato) throw eContrato;

    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await abrir(page, `/dashboard/fechamento?c=${ids.lead}&p=${ids.proposta}`);
    await expect(page.getByRole("heading", { name: "Candidatura e verificação" })).toBeVisible({ timeout: 30_000 });
    // E1141: é o assistente da estadia anterior — os valores e o número da proposta de 31 dias, não os da nova.
    const valores = page.getByTestId("fechamento-proposta");
    await expect(valores).toContainText(String(antiga!.numero), { timeout: 20_000 });
    await expect(valores).not.toContainText(String(nova.numero));
    await expect(page.locator(`[data-testid="fecho-linha"][data-chave="A:${ids.proposta}"]`)).toHaveAttribute("data-atual", "sim");

    // O mesmo caminho do caso 3 até à etapa do contrato (a identidade pode já estar verificada pelo caso 3).
    const verificar = page.getByRole("button", { name: /verificar identidade/i });
    if (await verificar.count()) await verificar.click();
    const continuar = page.getByRole("button", { name: /continuar/i });
    await expect(continuar).toBeEnabled({ timeout: 20_000 });
    await continuar.click();
    await page.getByRole("radio").and(page.locator(":not([disabled])")).first().click();
    await page.getByTestId("ciente-protecao").check({ timeout: 15_000 });
    await continuar.click();
    await expect(page.getByRole("heading", { name: /serviços adicionais/i })).toBeVisible({ timeout: 15_000 });
    await continuar.click();
    await page.getByRole("button", { name: /Seguir sem seguro patrimonial/ }).click();
    await continuar.click();

    const quadro = page.getByText("O morador vê no 1º pagamento", { exact: true }).locator("xpath=..");
    await expect(quadro).toBeVisible({ timeout: 15_000 });
    const total = quadro.getByText("1º pagamento", { exact: true }).locator("xpath=..");
    await expect(total, "o 1º pagamento é o da estadia anterior: o 1º bloco inteiro em dias").toContainText(/R\$\s?3\.143(?!\d)/);
    await expect(total, "nunca o 1º pagamento da proposta nova (R$ 4.000,00 por mês)").not.toContainText(/4\.000|4\.250|8\.000/);
    expect(semEspacoDuro(await quadro.innerText()), "a conta do 1º bloco por extenso, da proposta de 31 dias").toContain(CONTA);
    await total.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SAIDA}/t1789-4-estadia-anterior-quadro-1280.png` });
    await page.context().close();
  });
});
