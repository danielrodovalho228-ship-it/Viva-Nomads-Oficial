import { test, expect, type Browser, type Locator, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { addDiasISO } from "../../../src/lib/contrato-blocos";
import { textoDasPaginas } from "../../../src/lib/fiscal/pdf-texto";
import { hojeBR } from "../../../src/lib/utils";

/*
  T1711 — E1072 @E1072 (ORDEM-DUET-348): o registro do pagamento do bloco cobre o que o contrato diz — o aluguel do
  bloco, as contas do período e a limpeza de preparação —, cada componente discriminado, visível no pacote de provas e
  a contar para o quitado. O bloco registrado em partes completa-se com um registro complementar do mesmo bloco, com o
  seu recibo e a sua confirmação (migração 0348).
  A massa repete o contrato provado ao vivo em 20/11: 31 dias a R$ 2.500,00 por mês, contas de R$ 300,00 por mês e
  limpeza de preparação de R$ 250,00 → R$ 3.143,33 = aluguel R$ 2.583,33 + contas R$ 310,00 + limpeza R$ 250,00.
   1. Dono: o bloco mostra a conta do contrato e R$ 3.143,33 em aberto; o formulário chega com os três componentes
      preenchidos e o total; o registro grava o aluguel e os dois encargos, e o bloco fica quitado.
   2. Moradora: o pagamento a confirmar discrimina os três componentes; ela confirma uma vez.
   3. Pacote de provas (as duas partes): a linha do pagamento traz os três componentes e os totais contam os três.
   4. Um contrato com o registro de antes (só o aluguel): o bloco NÃO está quitado e a tela diz o que falta; o dono
      registra o que falta (contas e limpeza, R$ 560,00) num registro complementar e o bloco fica quitado.
   5. A moradora desse contrato confirma o complemento; sai o recibo dele; o pacote traz o complemento em linha própria
      e os totais chegam a R$ 3.143,33.
   6. (ORDEM-DUET-1104, julgamento 3 do coordenador: a parte tem UMA fonte, a coluna registada) Anulada a parte 1, o
      registro da parte 2 continua COMPLEMENTAR — na tela da moradora, no recibo dele e no pacote de provas. Antes, as
      leituras tiravam a parte da ordem dos registros ativos: sem a parte 1, o complemento passava a parecer a parte 1.
  Capturas a 390 e a 1280 px do formulário preenchido. Laboratório; não é prova ao vivo no site.
  Vizinha do E1072 (#4084, ORDEM-DUET-1095): corre também no portão do #4084, porque o registro do pagamento do bloco
  passou a conferir o teto também no 1º registro (não passa do que o contrato diz que o bloco custa).
*/
const SAIDA = "tests/laboratorio/saida";
const INICIO = hojeBR();
const FIM = addDiasISO(INICIO, 30); // 31 dias, contando o primeiro e o último
const CONTA = "valor do bloco R$ 2.583,33 + contas do período R$ 310,00 + limpeza de preparação R$ 250,00 = R$ 3.143,33";

const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1711.${sufixo}@lab.vivanomads.test`, nome: "Dora Componentes Sobrenome", role: "owner" as const };
const inq = { email: `inq.t1711.${sufixo}@lab.vivanomads.test`, nome: "Iris Componentes Sobrenome", role: "tenant" as const };
const inq2 = { email: `inq2.t1711.${sufixo}@lab.vivanomads.test`, nome: "Lia Componentes Sobrenome", role: "tenant" as const };
const ids: { dono?: string; inq?: string; inq2?: string; contrato?: string; bloco?: string; antigo?: string; terceiro?: string } = {};

/** Um contrato de 31 dias como o da prova: contas congeladas no contrato e limpeza de preparação no anúncio. */
async function contratoDe31Dias(titulo: string, inquilino: string): Promise<{ contrato: string; bloco: string }> {
  const imovel = await criarImovelPronto(ids.dono!, titulo, { ativo: true, preco: 2500 });
  const { error: eImovel } = await adm().from("properties").update({ prep_fee: 250 }).eq("id", imovel);
  if (eImovel) throw eImovel;
  const agora = new Date().toISOString();
  const { data, error } = await adm()
    .from("contratos")
    .insert({ property_id: imovel, tenant_id: inquilino, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 31, aluguel_mensal: 2500, tamanho_bloco_meses: 2, comissao_percent: 0.1, comissao_valor: 258.33, qtd_ocupantes: 1, status: "ativo", garantia: "caucao", assinado_proprietario_em: agora, assinado_inquilino_em: agora, pets_regras_congeladas: { outrosCustosMes: 300, limpezaEstadia: null } })
    .select("id")
    .single();
  if (error) throw error;
  const { data: b, error: eBloco } = await adm()
    .from("contrato_blocos")
    .insert({ contrato_id: data.id, numero_bloco: 1, inicio: INICIO, fim: FIM, meses: 2, valor: 2583.33, caucao: 1292, status: "ativo" })
    .select("id")
    .single();
  if (eBloco) throw eBloco;
  return { contrato: data.id as string, bloco: b.id as string };
}

const cartao = (page: Page, contrato: string): Locator => page.locator(`[data-testid="contrato-cartao"][data-contrato="${contrato}"]`);
/** O valor de um quadro do bloco, achado pelo rótulo que a tela mostra ("Em aberto", "Recebido (declarado)"). */
const quadro = (c: Locator, rotulo: string): Locator => c.getByText(rotulo, { exact: true }).locator("xpath=following-sibling::p[1]");
const pagamentosDoAntigo = async () => {
  const { data, error } = await adm().from("pagamentos_bloco").select("id, parte, valor, encargos, confirmado_pelo_inquilino").eq("contrato_id", ids.antigo!).eq("tipo", "aluguel").order("parte");
  if (error) throw error;
  return (data ?? []) as { id: string; parte: number; valor: number | string; encargos: { rotulo: string; valor: number }[]; confirmado_pelo_inquilino: boolean }[];
};
const pagamentoDoBloco = async () => {
  const { data, error } = await adm().from("pagamentos_bloco").select("valor, encargos, confirmado_pelo_inquilino").eq("contrato_id", ids.contrato!).eq("tipo", "aluguel");
  if (error) throw error;
  return (data ?? []) as { valor: number | string; encargos: { rotulo: string; valor: number }[]; confirmado_pelo_inquilino: boolean }[];
};
async function textoDoPacote(browser: Browser, email: string, contrato = ids.contrato!): Promise<string> {
  const page = await entrar(browser, email, senha);
  const resp = await page.request.get(`/api/contrato/${contrato}/provas`);
  expect(resp.status(), "a rota devolve o PDF").toBe(200);
  const texto = (await textoDasPaginas(new Uint8Array(await resp.body()))).join("\n").replace(/\s+/g, " ");
  await page.context().close();
  return texto;
}

test.describe("T1711 — E1072: o registro do pagamento cobre aluguel, contas e limpeza @E1072", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.inq2 = await criarConta(inq2, senha);
    const novo = await contratoDe31Dias(`[TESTE QA] Studio componentes ${sufixo}`, ids.inq);
    ids.contrato = novo.contrato;
    ids.bloco = novo.bloco;
    // O registro de antes da correção: só o aluguel do bloco, já confirmado, sem contas nem limpeza.
    const antigo = await contratoDe31Dias(`[TESTE QA] Studio registro antigo ${sufixo}`, ids.inq2);
    ids.antigo = antigo.contrato;
    const { error } = await adm()
      .from("pagamentos_bloco")
      .insert({ bloco_id: antigo.bloco, contrato_id: antigo.contrato, tipo: "aluguel", valor: 2583.33, forma: "pix", data_pagamento: INICIO, marcado_por: ids.dono, confirmado_pelo_inquilino: true, confirmado_em: new Date().toISOString(), encargos: [] });
    if (error) throw error;
  });

  test.afterAll(async () => {
    for (const c of [ids.contrato, ids.antigo, ids.terceiro]) {
      if (!c) continue;
      await adm().from("documentos_fiscais").delete().eq("contrato_id", c);
      await adm().from("pagamentos_bloco").delete().eq("contrato_id", c);
      await adm().from("contratos").delete().eq("id", c);
    }
    await apagarContas([ids.dono, ids.inq, ids.inq2]);
  });

  test("1. dono: o formulário chega com aluguel, contas e limpeza; o registro grava os três e o bloco fica quitado", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    const c = cartao(page, ids.contrato!);
    // As procuras são pelo texto que a tela mostra (não por marcas novas): no site sem a correção, falham pelo motivo do item.
    await expect(quadro(c, "Em aberto"), "o bloco deve o que o contrato diz: aluguel + contas + limpeza").toHaveText(/R\$\s3\.143,33/, { timeout: 30_000 });
    await expect(c).toContainText(`Pagamento deste bloco, pelo contrato: ${CONTA}.`);
    await expect(quadro(c, "Recebido (declarado)")).toHaveText(/^R\$\s0\s*$/);

    await c.getByTestId("registrar-recebimento").click();
    await expect(c.getByLabel("Contas do período")).toHaveValue("310");
    await expect(c.getByLabel("Limpeza de preparação")).toHaveValue("250");
    const total = c.getByText(/^Total deste registro:/);
    await expect(total).toHaveText("Total deste registro: R$ 3.143,33");
    for (const largura of [1280, 390] as const) {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await total.scrollIntoViewIfNeeded();
      await expect(total).toBeInViewport({ ratio: 1 });
      await expect(c.getByLabel("Contas do período")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${largura} px: sem rolagem lateral`).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `${SAIDA}/t1711-1-formulario-${largura}.png` });
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await c.getByTestId("confirmar-recebimento").click();
    await expect.poll(async () => (await pagamentoDoBloco()).length, { timeout: 30_000, message: "o registro grava" }).toBe(1);
    const [p] = await pagamentoDoBloco();
    expect(Number(p.valor), "o valor do registro é o aluguel do bloco").toBe(2583.33);
    expect(p.encargos, "as contas e a limpeza ficam discriminadas no registro").toEqual([
      { rotulo: "Contas do período", valor: 310 },
      { rotulo: "Limpeza de preparação", valor: 250 },
    ]);

    await page.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    const depois = cartao(page, ids.contrato!);
    await expect(quadro(depois, "Recebido (declarado)")).toHaveText(/R\$\s3\.143,33/, { timeout: 30_000 });
    await expect(quadro(depois, "Em aberto")).toHaveText(/^R\$\s0\s*$/);
    await expect(depois.getByText("Valor do bloco registrado como recebido.")).toBeVisible();
    await expect(depois.getByTestId("registrar-recebimento")).toHaveCount(0);
    await page.context().close();
  });

  test("2. moradora: o pagamento a confirmar discrimina os três componentes e ela confirma uma vez", async ({ browser }) => {
    const page = await entrar(browser, inq.email, senha);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
    const confirmar = page.getByTestId("confirmar-pagamentos");
    await expect(confirmar).toContainText(`Este registro: ${CONTA}.`, { timeout: 30_000 });
    await expect(confirmar.getByRole("button", { name: /Confirmar/ })).toHaveCount(1);
    await confirmar.scrollIntoViewIfNeeded();
    await confirmar.screenshot({ path: `${SAIDA}/t1711-2-moradora-confirmar-390.png` });
    await confirmar.getByRole("button", { name: /Confirmar/ }).click();
    await expect.poll(async () => (await pagamentoDoBloco())[0]?.confirmado_pelo_inquilino, { timeout: 30_000 }).toBe(true);
    await page.context().close();
  });

  test("3. pacote de provas, nas duas partes: os três componentes na linha do pagamento e nos totais", async ({ browser }) => {
    for (const [quem, email] of [["dono", dono.email], ["moradora", inq.email]] as const) {
      const texto = await textoDoPacote(browser, email);
      expect(texto, `${quem}: a linha do pagamento discrimina os componentes`).toContain("Aluguel de R$ 2.583,33 + contas do período de R$ 310,00 + limpeza de preparação de R$ 250,00 = R$ 3.143,33 (Pix, em");
      expect(texto, `${quem}: os totais contam os três componentes`).toContain("Confirmados pelo inquilino: R$ 3.143,33. Aguardando confirmação do inquilino: R$ 0,00.");
      expect(texto, `${quem}: a linha do tempo diz o total`).toContain("com contas do período de R$ 310,00 e limpeza de preparação de R$ 250,00: total de R$ 3.143,33.");
    }
  });

  test("4. registro de antes, só com o aluguel: a tela diz o que falta e o dono completa com um registro complementar", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    const c = cartao(page, ids.antigo!);
    await expect(quadro(c, "Em aberto"), "faltam as contas e a limpeza").toHaveText(/R\$\s560/, { timeout: 30_000 });
    await expect(c.getByText(/^Falta registrar/)).toHaveText(/Falta registrar R\$\s560 deste bloco \(contas do período R\$\s310, limpeza de preparação R\$\s250\)\./);
    await expect(quadro(c, "Recebido (declarado)")).toHaveText(/R\$\s2\.583,33/);
    await expect(c.getByText("Valor do bloco registrado como recebido.")).toHaveCount(0);

    // O registro complementar: só o que falta, sem campo de aluguel (não falta aluguel).
    await c.getByRole("button", { name: "Registrar o que falta" }).click();
    await expect(c.getByLabel("Contas do período")).toHaveValue("310");
    await expect(c.getByLabel("Limpeza de preparação")).toHaveValue("250");
    await expect(c.getByLabel("Valor do bloco que falta")).toHaveCount(0);
    await expect(c.getByText(/^Total deste registro:/)).toHaveText(/Total deste registro: R\$\s560/);
    await c.getByTestId("confirmar-recebimento").click();
    await expect.poll(async () => (await pagamentosDoAntigo()).length, { timeout: 30_000, message: "o complemento grava" }).toBe(2);
    const [primeiro, complemento] = await pagamentosDoAntigo();
    expect([primeiro.parte, complemento.parte], "o primeiro registro é a parte 1 e o complemento a parte 2").toEqual([1, 2]);
    expect(Number(primeiro.valor), "o registro de antes não foi mexido").toBe(2583.33);
    expect(primeiro.encargos).toEqual([]);
    expect(Number(complemento.valor)).toBe(0);
    expect(complemento.encargos).toEqual([
      { rotulo: "Contas do período", valor: 310 },
      { rotulo: "Limpeza de preparação", valor: 250 },
    ]);

    await page.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    const depois = cartao(page, ids.antigo!);
    await expect(quadro(depois, "Recebido (declarado)")).toHaveText(/R\$\s3\.143,33/, { timeout: 30_000 });
    await expect(quadro(depois, "Em aberto")).toHaveText(/^R\$\s0\s*$/);
    await expect(depois.getByText("Valor do bloco registrado como recebido.")).toBeVisible();
    await expect(depois.getByRole("button", { name: "Registrar o que falta" })).toHaveCount(0);
    await page.context().close();
  });

  test("5. a moradora confirma o complemento: sai o recibo dele e o pacote traz o complemento em linha própria", async ({ browser }) => {
    const page = await entrar(browser, inq2.email, senha);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
    const confirmar = page.getByTestId("confirmar-pagamentos");
    await expect(confirmar).toContainText("Bloco 1, registro complementar", { timeout: 30_000 });
    await expect(confirmar).toContainText("Este registro: contas do período R$ 310,00 + limpeza de preparação R$ 250,00 = R$ 560,00.");
    await expect(confirmar.getByRole("button", { name: /Confirmar/ })).toHaveCount(1);
    await confirmar.scrollIntoViewIfNeeded();
    await confirmar.screenshot({ path: `${SAIDA}/t1711-5-moradora-complemento-390.png` });
    await confirmar.getByRole("button", { name: /Confirmar/ }).click();
    await expect.poll(async () => (await pagamentosDoAntigo())[1]?.confirmado_pelo_inquilino, { timeout: 30_000 }).toBe(true);
    await page.context().close();

    const complemento = (await pagamentosDoAntigo())[1];
    await expect
      .poll(async () => ((await adm().from("documentos_fiscais").select("tipo, pagamento_id").eq("contrato_id", ids.antigo!)).data ?? []).filter((d) => d.tipo === "recibo_aluguel" && d.pagamento_id === complemento.id).length, { timeout: 60_000, message: "o complemento tem o seu recibo" })
      .toBe(1);
    const { data: recibos } = await adm().from("documentos_fiscais").select("numero").eq("contrato_id", ids.antigo!).eq("pagamento_id", complemento.id);
    const texto = await textoDoPacote(browser, inq2.email, ids.antigo!);
    expect(texto).toContain("Registro complementar de R$ 560,00 — contas do período de R$ 310,00 + limpeza de preparação de R$ 250,00 (Pix, em");
    expect(texto, "o recibo do complemento aparece pelo número").toContain(String(recibos![0].numero));
    expect(texto, "os totais somam o registro de antes e o complemento").toContain("Confirmados pelo inquilino: R$ 3.143,33. Aguardando confirmação do inquilino: R$ 0,00.");
    expect(texto).toContain("Registro complementar de R$ 560,00 confirmado pelo inquilino.");
  });

  test("6. anulada a parte 1, a parte 2 continua complementar: na tela, no recibo e no pacote de provas", async ({ browser }) => {
    // Um contrato com a parte 1 (só o aluguel, confirmada) e a parte 2 (contas e limpeza, por confirmar), como no caso 4.
    const c3 = await contratoDe31Dias(`[TESTE QA] Studio parte anulada ${sufixo}`, ids.inq2!);
    ids.terceiro = c3.contrato;
    const agora = new Date().toISOString();
    const { data: p1, error: e1 } = await adm()
      .from("pagamentos_bloco")
      .insert({ bloco_id: c3.bloco, contrato_id: c3.contrato, tipo: "aluguel", parte: 1, valor: 2583.33, forma: "pix", data_pagamento: INICIO, marcado_por: ids.dono, confirmado_pelo_inquilino: true, confirmado_em: agora, encargos: [] })
      .select("id")
      .single();
    if (e1) throw e1;
    const { data: p2, error: e2 } = await adm()
      .from("pagamentos_bloco")
      .insert({ bloco_id: c3.bloco, contrato_id: c3.contrato, tipo: "aluguel", parte: 2, valor: 0, forma: "pix", data_pagamento: INICIO, marcado_por: ids.dono, encargos: [{ rotulo: "Contas do período", valor: 310 }, { rotulo: "Limpeza de preparação", valor: 250 }] })
      .select("id")
      .single();
    if (e2) throw e2;
    // A parte 1 é anulada (a anulação lógica da casa: data e motivo).
    const { error: eA } = await adm().from("pagamentos_bloco").update({ anulado_em: new Date().toISOString(), anulado_motivo: "registro em duplicidade" }).eq("id", p1.id);
    if (eA) throw eA;

    // Na tela da moradora, o registro por confirmar continua a dizer-se complementar.
    const page = await entrar(browser, inq2.email, senha);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
    const confirmar = page.getByTestId("confirmar-pagamentos");
    await expect(confirmar, "a parte 2 continua complementar depois de anulada a parte 1").toContainText("Bloco 1, registro complementar", { timeout: 30_000 });
    await expect(confirmar).toContainText("Este registro: contas do período R$ 310,00 + limpeza de preparação R$ 250,00 = R$ 560,00.");
    await confirmar.getByRole("button", { name: /Confirmar/ }).click();
    await expect.poll(async () => (await adm().from("pagamentos_bloco").select("confirmado_pelo_inquilino").eq("id", p2.id).single()).data?.confirmado_pelo_inquilino, { timeout: 30_000 }).toBe(true);

    // O recibo dele diz que é o registro complementar.
    await expect
      .poll(async () => ((await adm().from("documentos_fiscais").select("id").eq("pagamento_id", p2.id).eq("tipo", "recibo_aluguel")).data ?? []).length, { timeout: 60_000, message: "o complemento tem o seu recibo" })
      .toBe(1);
    const { data: doc } = await adm().from("documentos_fiscais").select("id").eq("pagamento_id", p2.id).eq("tipo", "recibo_aluguel").single();
    const pdf = await page.request.get(`/api/documentos/${doc!.id}`);
    expect(pdf.status(), "o recibo abre").toBe(200);
    const recibo = (await textoDasPaginas(new Uint8Array(await pdf.body()))).join("\n").replace(/\s+/g, " ");
    expect(recibo, "o recibo da parte 2 diz que é o registro complementar").toContain("Bloco 1, registro complementar");
    await page.context().close();

    // O pacote de provas (documento registado) continua a chamar-lhe complementar.
    const texto = await textoDoPacote(browser, inq2.email, c3.contrato);
    expect(texto, "o pacote chama complementar à parte 2").toContain("Registro complementar de R$ 560,00 — contas do período de R$ 310,00 + limpeza de preparação de R$ 250,00 (Pix, em");
  });
});
