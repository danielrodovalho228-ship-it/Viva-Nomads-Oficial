import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1702 — E1061: a caução que a proposta mostra é a do contrato, da estadia toda — o mesmo número no formulário do dono,
  na proposta que a moradora recebe e no Fechamento. Lei do produto (Daniel, 20/11/2026): metade do aluguel da estadia
  toda, no máximo 3 vezes o valor mensal.
  Caso: aluguel de R$ 2.800 e candidatura de 90 dias. O contrato divide a estadia em 2 blocos (60 + 30 dias) e a caução
  soma R$ 4.200 (50% de 3 aluguéis). Antes, a proposta mostrava só os R$ 2.800 do 1º bloco e o Fechamento os R$ 4.200.
   0. Na página do imóvel, sem datas, a linha é a de referência ("Caução do 1º bloco (1 mês)": R$ 1.400). Com 31 dias
      escolhidos no calendário (o caso da prova ao vivo), passa a "Caução nesta estadia (31 dias)": R$ 1.447, o do contrato.
   1. O dono monta a proposta: a linha "Caução (50% do aluguel da estadia, 90 dias)" mostra R$ 4.200.
   2. A moradora abre a proposta: a mesma linha, o mesmo valor, e a parte do 1º bloco por baixo; aceita.
   3. O dono vai até a minuta do Fechamento: o quadro "antes da entrada" mostra a caução de R$ 4.200.
  Capturas a 390 e a 1280 px das duas linhas da proposta. Laboratório; não é prova ao vivo no site.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1702.${sufixo}@lab.vivanomads.test`, nome: "Dora Caução Sobrenome", role: "owner" as const };
const inq = { email: `inq.t1702.${sufixo}@lab.vivanomads.test`, nome: "Iris Caução Sobrenome", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; lead?: string; proposta?: string } = {};
const SAIDA = "tests/laboratorio/saida";

const emDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const ENTRADA = emDias(30);
const SAIDA_DATA = emDias(120); // 90 dias
const ROTULO = "Caução (50% do aluguel da estadia, 90 dias)";
const VALOR = "R$ 4.200";

const maisDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function abrir(page: Page, rota: string) {
  await page.goto(rota, { waitUntil: "domcontentloaded" });
  await page.locator("main").first().waitFor();
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}

test.describe("T1702 — E1061: a caução da proposta é a do contrato (90 dias, 2 blocos)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    // Contas de teste: o contrato sai no modo TESTE (sem assinatura digital real).
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    ids.imovel = await criarImovelPronto(ids.dono, `[TESTE QA] Studio 90 dias ${sufixo}`, { ativo: true, preco: 2800 });
    const { error: e1 } = await adm()
      .from("properties")
      .update({ condo_fee: 0, utilities_mode: "fixed", utilities_estimate: 250, prep_fee: 300, checkout_cleaning_enabled: false, checkout_cleaning_fee: 0, limpeza_estadia: null, min_period_days: 30, max_period_days: 180 })
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

  test("0. na página do imóvel, com 31 dias escolhidos, a caução é a do contrato para essa estadia", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "networkidle" });
    const caucao = page.locator('#cartao-preco [data-taxa="caucao"]');
    await expect(caucao).toContainText("Caução do 1º bloco (1 mês)", { timeout: 20_000 });
    await expect(caucao).toContainText("R$ 1.400");
    // Uma entrada com 31 dias livres depois dela, dentro dos meses do calendário (o mesmo jeito da t357).
    const livres = page.locator('#disponibilidade button[data-estado-dia="disponivel"]');
    await expect(livres.first()).toBeVisible({ timeout: 20_000 });
    const todos = await livres.evaluateAll((els) => els.map((e) => e.getAttribute("data-dia") ?? ""));
    const entrada = todos.find((d) => todos.includes(maisDias(d, 31)));
    expect(entrada, "precisa haver 31 dias livres no calendário").toBeTruthy();
    await page.locator(`#disponibilidade button[data-dia="${entrada}"]`).click();
    await page.locator(`#disponibilidade button[data-dia="${maisDias(entrada!, 31)}"]`).click();
    await expect(caucao).toContainText("Caução nesta estadia (31 dias)", { timeout: 20_000 });
    // 2.800 × 31 ÷ 30 ÷ 2 = 1.446,67 → R$ 1.447, o mesmo arredondamento do contrato.
    await expect(caucao).toContainText("R$ 1.447");
    await caucao.scrollIntoViewIfNeeded();
    await caucao.screenshot({ path: `${SAIDA}/t1702-0-pagina-caucao-31-dias-1280.png` });
  });

  test("1. o dono monta a proposta de 90 dias: a caução é a da estadia toda (R$ 4.200)", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await abrir(page, `/dashboard/orcamentos/nova?interessado=${ids.lead}`);
    await expect(page.getByTestId("montagem-proposta")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("proposta-dias")).toContainText("90 dias");
    const valor = page.getByTestId("resumo-caucao");
    await expect(valor).toContainText(VALOR);
    const linha = valor.locator("xpath=..");
    await expect(linha).toContainText(ROTULO);
    await linha.scrollIntoViewIfNeeded();
    await linha.screenshot({ path: `${SAIDA}/t1702-1-dono-caucao-1280.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await linha.scrollIntoViewIfNeeded();
    await linha.screenshot({ path: `${SAIDA}/t1702-1-dono-caucao-390.png` });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByTestId("proposta-validade").selectOption("7");
    await page.getByTestId("enviar-proposta").click();
    await page.waitForURL(/\/dashboard\/propostas\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    ids.proposta = page.url().split("/").pop()!;
    await page.context().close();
  });

  test("2. a moradora vê a mesma caução, com a parte do 1º bloco por baixo, e aceita", async ({ browser }) => {
    const pi = await entrar(browser, inq.email, senha);
    await pi.setViewportSize({ width: 1280, height: 900 });
    await abrir(pi, `/dashboard/propostas/${ids.proposta}`);
    await expect(pi.getByTestId("proposta-aceitar")).toBeVisible({ timeout: 20_000 });
    const caucao = pi.getByTestId("proposta-atual").getByTestId("proposta-caucao");
    await expect(caucao).toContainText(ROTULO);
    await expect(caucao).toContainText(VALOR);
    await expect(caucao.getByTestId("proposta-caucao-blocos")).toContainText("R$ 2.800 no 1º bloco");
    await caucao.scrollIntoViewIfNeeded();
    await caucao.screenshot({ path: `${SAIDA}/t1702-2-moradora-caucao-1280.png` });
    await pi.setViewportSize({ width: 390, height: 844 });
    await caucao.scrollIntoViewIfNeeded();
    await caucao.screenshot({ path: `${SAIDA}/t1702-2-moradora-caucao-390.png` });
    await pi.setViewportSize({ width: 1280, height: 900 });
    await pi.getByTestId("proposta-aceitar").click();
    await expect.poll(async () => (await adm().from("propostas").select("status").eq("id", ids.proposta!).single()).data?.status, { timeout: 20_000 }).toBe("aceita");
    await pi.context().close();
  });

  test("3. o Fechamento mostra a mesma caução no quadro \"antes da entrada\"", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await abrir(page, `/dashboard/fechamento?c=${ids.lead}`);
    await expect(page.getByTestId("fechamento-prazo-dias")).toContainText("90 dias", { timeout: 20_000 });
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
    await expect(page.getByTestId("marca-minuta")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("entrada-caucao")).toContainText(VALOR);
    await page.context().close();
  });
});
