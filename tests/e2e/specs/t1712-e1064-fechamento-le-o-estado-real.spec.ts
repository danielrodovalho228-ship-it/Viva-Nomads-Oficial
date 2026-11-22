import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1712 — E1064 @E1064: o Fechamento lê o estado REAL — a verificação de identidade e o contrato.
  Na prova ao vivo de 20/11 o passo 1 pedia o clique "Verificar identidade" a um dono que já tinha a identidade
  confirmada, o selo "Identidade pendente" não dizia de quem era nem mudava depois de o portão abrir e, com o contrato
  já gerado, o Fechamento reaberto recomeçava no passo 1 sem dizer nada do contrato.
   1. Dono SEM identidade confirmada: o passo 1 tem o botão; o selo diz "Identidade do morador: pendente"; o clique
      abre o portão (como sempre).
   2. Dono COM a identidade já confirmada (a do caso 1): o Fechamento reaberto não pede clique — diz "Sua identidade já
      está confirmada", com a validade, e "Continuar" já está liberado.
   3. A moradora confirma a identidade na conta dela: o selo passa a "Identidade do morador: verificada".
   4. O Resumo separa as duas pessoas ("Identidade do morador" e "Sua verificação"); com o contrato gerado, o Fechamento
      reaberto diz logo no passo 1 que a candidatura já tem contrato, com a situação real e o caminho para ele.
  As procuras são pelo texto que a tela mostra. Capturas a 390 e a 1280 px do passo 1 com a identidade já confirmada.
  Laboratório; não é prova ao vivo no site.
*/
const SAIDA = "tests/laboratorio/saida";
const emDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1712.${sufixo}@lab.vivanomads.test`, nome: "Dora Portão Sobrenome", role: "owner" as const };
const inq = { email: `inq.t1712.${sufixo}@lab.vivanomads.test`, nome: "Iris Portão Sobrenome", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; lead?: string } = {};

async function noFechamento(browser: Browser, largura = 1280): Promise<Page> {
  const page = await entrar(browser, dono.email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  await page.goto(`/dashboard/fechamento?c=${ids.lead}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Candidatura e verificação" })).toBeVisible({ timeout: 30_000 });
  return page;
}
const botaoVerificar = (page: Page) => page.getByRole("button", { name: /^Verificar identidade$/ });
const continuar = (page: Page) => page.getByRole("button", { name: /continuar/i });

test.describe("T1712 — E1064: o Fechamento lê a verificação real e o estado do contrato @E1064", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    // Contas de teste: a verificação é a simulada e o contrato sai no modo TESTE.
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    ids.imovel = await criarImovelPronto(ids.dono, `[TESTE QA] Studio portão ${sufixo}`, { ativo: true, preco: 2800 });
    const { error: e1 } = await adm()
      .from("properties")
      .update({ condo_fee: 0, utilities_mode: "fixed", utilities_estimate: 250, prep_fee: 300, checkout_cleaning_enabled: false, checkout_cleaning_fee: 0, limpeza_estadia: null, min_period_days: 30, max_period_days: 180 })
      .eq("id", ids.imovel);
    if (e1) throw e1;
    const { data, error } = await adm()
      .from("leads")
      .insert({ owner_id: ids.dono, tenant_id: ids.inq, property_id: ids.imovel, status: "accepted", inicio_desejado: emDias(30), fim_desejado: emDias(90) })
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

  test("1. dono sem identidade confirmada: o botão existe, o selo diz de quem é e o clique abre o portão", async ({ browser }) => {
    const page = await noFechamento(browser);
    const principal = page.locator("main");
    await expect(principal, "o selo diz de quem é a identidade").toContainText("Identidade do morador: pendente");
    await expect(botaoVerificar(page)).toBeVisible();
    await expect(continuar(page), "sem verificação, não avança").toBeDisabled();
    await botaoVerificar(page).click();
    await expect(continuar(page)).toBeEnabled({ timeout: 20_000 });
    // O clique conferiu o DONO: a identidade da moradora não mudou, e a tela continua a dizer de quem é o selo.
    await expect(principal).toContainText("Identidade do morador: pendente");
    await page.context().close();
  });

  test("2. dono com a identidade já confirmada: o Fechamento reaberto não pede clique", async ({ browser }) => {
    const page = await noFechamento(browser);
    const principal = page.locator("main");
    await expect(principal, "a identidade de quem fecha já está confirmada").toContainText("Sua identidade já está confirmada", { timeout: 30_000 });
    await expect(principal).toContainText(/Identidade confirmada · válida até \d{2}\/\d{2}\/\d{4}/);
    await expect(botaoVerificar(page), "nada a clicar").toHaveCount(0);
    await expect(continuar(page), "o portão já abre aberto").toBeEnabled();
    const painel = page.getByText("Sua identidade já está confirmada");
    for (const largura of [1280, 390] as const) {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await painel.scrollIntoViewIfNeeded();
      await expect(painel).toBeInViewport({ ratio: 1 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${largura} px: sem rolagem lateral`).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `${SAIDA}/t1712-2-identidade-ja-confirmada-${largura}.png` });
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await continuar(page).click();
    await expect(page.getByRole("radio").first(), "avança para a garantia sem clique de verificação").toBeVisible({ timeout: 15_000 });
    await page.context().close();
  });

  test("3. a moradora confirma a identidade na conta dela: o selo do Fechamento acompanha", async ({ browser }) => {
    const pi = await entrar(browser, inq.email, senha);
    const resp = await pi.request.post("/api/caf/verify");
    expect(resp.status(), "a verificação simulada da conta de teste responde").toBe(200);
    await pi.context().close();

    const page = await noFechamento(browser);
    await expect(page.locator("main")).toContainText("Identidade do morador: verificada", { timeout: 30_000 });
    await page.context().close();
  });

  test("4. o Resumo separa as duas pessoas; com o contrato gerado, o Fechamento reaberto diz a situação dele", async ({ browser }) => {
    const page = await noFechamento(browser);
    await continuar(page).click();
    await page.getByRole("radio").and(page.locator(":not([disabled])")).first().click();
    await page.getByTestId("ciente-protecao").check({ timeout: 15_000 });
    await continuar(page).click();
    await expect(page.getByRole("heading", { name: /serviços adicionais/i })).toBeVisible({ timeout: 15_000 });
    await continuar(page).click();
    await page.getByRole("button", { name: /Seguir sem seguro patrimonial/ }).click();
    await continuar(page).click();
    await page.getByTestId("fechamento-gerar-contrato").click();
    await expect(page.getByTestId("fechamento-abrir-contrato")).toBeVisible({ timeout: 40_000 });
    await continuar(page).click();
    const principal = page.locator("main");
    await expect(principal).toContainText("Identidade do morador", { timeout: 15_000 });
    await expect(principal).toContainText("Identidade verificada");
    await expect(principal).toContainText("Sua verificação");
    await expect(principal).toContainText(/Identidade confirmada · válida até \d{2}\/\d{2}\/\d{4}/);
    await expect(principal, "o laudo do dono não é mais chamado de verificação do morador").not.toContainText("Verificação do morador");
    await page.context().close();

    const { data: contrato } = await adm().from("contratos").select("id").eq("lead_id", ids.lead!).single();
    const de_novo = await noFechamento(browser, 390);
    const aviso = de_novo.getByText("Esta candidatura já tem contrato.");
    await expect(aviso, "o Fechamento reaberto diz que já há contrato, no passo 1").toBeVisible({ timeout: 30_000 });
    await expect(de_novo.locator("main")).toContainText(/Situação do contrato: \S+/);
    const ver = de_novo.getByRole("link", { name: "Ver contrato" }).first();
    await expect(ver).toHaveAttribute("href", new RegExp(String(contrato!.id)));
    await aviso.scrollIntoViewIfNeeded();
    await de_novo.screenshot({ path: `${SAIDA}/t1712-4-contrato-ja-existe-390.png` });
    await de_novo.context().close();
  });
});
