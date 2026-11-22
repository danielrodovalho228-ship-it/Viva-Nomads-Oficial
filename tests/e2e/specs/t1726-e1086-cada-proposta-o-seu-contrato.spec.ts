import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, lerSaida, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1726 — E1086 @E1086 (ORDEM-DUET-420): cada proposta aceita gera o SEU contrato.
  A prova ao vivo de 21/11: a proposta ORC-2026-0018 (aceita, datas novas) abriu no Fechamento o contrato JÁ ASSINADO
  de outra estadia; "Gerar contrato" não criou contrato nem mandou o e-mail de geração.
  A mesma sequência, pela tela, com contas de teste e uma só candidatura (o morador tem uma por imóvel):
   1. 1ª estadia: o dono envia a proposta, a moradora aceita, o dono gera o contrato. As duas partes assinam (gravado
      no banco do laboratório, como na t1720).
   2. 2ª estadia, datas novas, MESMA candidatura: proposta nova, aceite. O Fechamento reaberto NÃO diz "já tem
      contrato" (o que existe é de outra estadia). O dono gera: nasce um contrato NOVO, da proposta nova, com as datas
      e o prazo dela; o contrato assinado da 1ª estadia fica como estava. Há reserva e cobrança da taxa próprias, a
      proposta nova fica "em contrato" e o e-mail "contrato pronto" sai de novo.
   3. O Fechamento reaberto depois mostra o contrato da 2ª estadia (a 390 e a 1280 px).
  Laboratório; não é prova ao vivo no site.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1726.${sufixo}@lab.vivanomads.test`, nome: "Dalva Estadia Sobrenome", role: "owner" as const };
const inq = { email: `inq.t1726.${sufixo}@lab.vivanomads.test`, nome: "Ines Estadia Sobrenome", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; lead?: string; p1?: string; p2?: string; c1?: string; c2?: string } = {};

const emDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
// 1ª estadia: 45 dias. 2ª estadia: 40 dias, depois da primeira (sem sobreposição no imóvel).
const E1 = { entrada: emDias(30), saida: emDias(75), dias: 45 };
const E2 = { entrada: emDias(100), saida: emDias(140), dias: 40 };

type Contrato = { id: string; proposta_id: string | null; prazo_total_dias: number; periodo: string; assinado_proprietario_em: string | null; assinado_inquilino_em: string | null };
const contratos = async (): Promise<Contrato[]> =>
  (((await adm().from("contratos").select("id, proposta_id, prazo_total_dias, periodo, assinado_proprietario_em, assinado_inquilino_em").eq("lead_id", ids.lead!).order("created_at")).data ?? []) as Contrato[]);
const reservas = async () =>
  (((await adm().from("cobrancas_fechamento").select("tipo, externo_id").eq("lead_id", ids.lead!)).data ?? []) as { tipo: string; externo_id: string | null }[]);
const statusDa = async (proposta: string) => (await adm().from("propostas").select("status").eq("id", proposta).single()).data?.status as string;
/** E-mails "contrato pronto" deste imóvel no que o laboratório "teria enviado" (morador e dono recebem um cada, a cada geração). */
const emailsContratoPronto = async () =>
  (await lerSaida()).filter((m) => m.servico === "email" && String(m.assunto ?? "").includes("contrato está pronto para assinar") && JSON.stringify(m).includes(sufixo)).length;

/** O dono monta e envia a proposta pela tela; a moradora aceita. Devolve o id da proposta. */
async function proporEAceitar(browser: Browser, estadia: { entrada: string; saida: string; dias: number }): Promise<string> {
  const pd = await entrar(browser, dono.email, senha);
  await pd.setViewportSize({ width: 1280, height: 900 });
  await pd.goto(`/dashboard/orcamentos/nova?interessado=${ids.lead}`, { waitUntil: "domcontentloaded" });
  await expect(pd.getByTestId("montagem-proposta")).toBeVisible({ timeout: 30_000 });
  await pd.getByTestId("proposta-data").fill(estadia.entrada);
  await pd.getByTestId("proposta-saida").fill(estadia.saida);
  await expect(pd.getByTestId("proposta-dias")).toContainText(`${estadia.dias} dias`);
  await pd.getByTestId("proposta-validade").selectOption("7");
  await pd.getByTestId("enviar-proposta").click();
  await pd.waitForURL(/\/dashboard\/propostas\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const proposta = pd.url().split("/").pop()!;
  await pd.context().close();

  const pi = await entrar(browser, inq.email, senha);
  await pi.goto(`/dashboard/propostas/${proposta}`, { waitUntil: "domcontentloaded" });
  await pi.getByTestId("proposta-aceitar").click({ timeout: 30_000 });
  await expect.poll(() => statusDa(proposta), { timeout: 30_000 }).toBe("aceita");
  await pi.context().close();
  return proposta;
}

async function noFechamento(browser: Browser, largura: 390 | 1280 = 1280): Promise<Page> {
  const page = await entrar(browser, dono.email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  await page.goto(`/dashboard/fechamento?c=${ids.lead}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Candidatura e verificação" })).toBeVisible({ timeout: 30_000 });
  return page;
}

/** O dono atravessa o Fechamento e clica "Gerar contrato" (os mesmos passos da t863). */
async function gerarContratoPelaTela(page: Page) {
  const continuar = page.getByRole("button", { name: /continuar/i });
  // Com a identidade já confirmada o passo abre liberado; senão, o clique "Verificar identidade".
  const verificar = page.getByRole("button", { name: /verificar identidade/i });
  if (await verificar.isVisible().catch(() => false)) await verificar.click();
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
  await page.getByTestId("fechamento-gerar-contrato").click();
  await expect(page.getByTestId("fechamento-abrir-contrato")).toBeVisible({ timeout: 30_000 });
}

test.describe("T1726 — E1086: cada proposta aceita gera o seu contrato (2ª estadia na mesma candidatura) @E1086", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(300_000);

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    // Contas de teste: contrato e cobrança saem no modo TESTE (nada vai à assinatura digital nem ao banco de cobrança).
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    ids.imovel = await criarImovelPronto(ids.dono, `[TESTE QA] Duas estadias ${sufixo}`, { ativo: true, preco: 2800 });
    const { error: e1 } = await adm().from("properties").update({ min_period_days: 30, max_period_days: 180 }).eq("id", ids.imovel);
    if (e1) throw e1;
    const { data, error } = await adm()
      .from("leads")
      .insert({ owner_id: ids.dono, tenant_id: ids.inq, property_id: ids.imovel, status: "new", inicio_desejado: E1.entrada, fim_desejado: E1.saida })
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

  test("1. 1ª estadia: proposta aceita, contrato gerado pela tela e assinado pelas duas partes", async ({ browser }) => {
    ids.p1 = await proporEAceitar(browser, E1);
    const page = await noFechamento(browser);
    await gerarContratoPelaTela(page);
    await page.context().close();
    const cs = await contratos();
    expect(cs.length, "um contrato").toBe(1);
    expect(cs[0].proposta_id, "o contrato é da 1ª proposta").toBe(ids.p1);
    expect(Number(cs[0].prazo_total_dias)).toBe(E1.dias);
    ids.c1 = cs[0].id;
    await expect.poll(() => statusDa(ids.p1!), { timeout: 15_000 }).toBe("em_contrato");
    await expect.poll(emailsContratoPronto, { timeout: 20_000, message: "o e-mail de geração da 1ª estadia saiu" }).toBeGreaterThan(0);
    // As duas partes assinam (gravado no banco do laboratório): o caso da prova é o contrato JÁ ASSINADO.
    const agora = new Date().toISOString();
    const { error } = await adm().from("contratos").update({ assinado_proprietario_em: agora, assinado_inquilino_em: agora }).eq("id", ids.c1);
    if (error) throw error;
  });

  test("2. 2ª estadia na mesma candidatura: a proposta nova gera o contrato DELA; o contrato assinado da 1ª fica como estava", async ({ browser }) => {
    const emailsAntes = await emailsContratoPronto();
    ids.p2 = await proporEAceitar(browser, E2);
    const page = await noFechamento(browser);
    // O contrato que existe é de OUTRA estadia: o Fechamento da proposta nova não diz "já tem contrato".
    await expect(page.getByTestId("fechamento-proposta-contrato")).toBeVisible({ timeout: 20_000 });
    // (soft: mesmo com este aviso errado, a trava segue até "Gerar contrato" e mostra também que o contrato não nasce.)
    await expect.soft(page.getByTestId("fechamento-contrato-existente"), "o contrato da 1ª estadia não é o desta proposta").toHaveCount(0, { timeout: 5_000 });
    await page.getByTestId("fechamento-proposta-contrato").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SAIDA}/t1726-2-fechamento-da-proposta-nova-1280.png` });
    await gerarContratoPelaTela(page);
    await page.context().close();

    // Nasceu um contrato NOVO, da proposta nova, com o prazo e as datas dela.
    const cs = await contratos();
    expect(cs.length, "a 2ª estadia tem o contrato dela (antes: continuava só o de janeiro)").toBe(2);
    const novo = cs.find((c) => c.id !== ids.c1)!;
    ids.c2 = novo.id;
    expect(novo.proposta_id, "o contrato novo é da proposta nova").toBe(ids.p2);
    expect(Number(novo.prazo_total_dias)).toBe(E2.dias);
    expect(novo.periodo, "o período do contrato novo começa na entrada da proposta nova").toContain(E2.entrada);
    expect(novo.assinado_proprietario_em, "o contrato novo nasce por assinar").toBeNull();
    expect(novo.assinado_inquilino_em).toBeNull();
    // O contrato assinado da 1ª estadia fica como estava.
    const antigo = cs.find((c) => c.id === ids.c1)!;
    expect(antigo.proposta_id).toBe(ids.p1);
    expect(Number(antigo.prazo_total_dias)).toBe(E1.dias);
    expect(antigo.periodo).toContain(E1.entrada);
    expect(antigo.assinado_proprietario_em).not.toBeNull();
    expect(antigo.assinado_inquilino_em).not.toBeNull();
    // Reserva de geração e cobrança da taxa próprias de cada estadia.
    await expect.poll(async () => (await reservas()).filter((r) => r.tipo === "comissao" && r.externo_id).length, { timeout: 20_000 }).toBe(2);
    const rs = await reservas();
    const docs = rs.filter((r) => r.tipo === "contrato").map((r) => r.externo_id);
    expect(docs.length, "duas reservas de contrato, uma por proposta").toBe(2);
    expect(new Set(docs).size, "cada uma com o documento dela").toBe(2);
    // A proposta nova fica "em contrato" e a moradora recebe o e-mail de geração de novo.
    await expect.poll(() => statusDa(ids.p2!), { timeout: 15_000 }).toBe("em_contrato");
    await expect.poll(emailsContratoPronto, { timeout: 20_000, message: "o e-mail de geração sai de novo, para as mesmas pessoas" }).toBe(emailsAntes * 2);
  });

  for (const largura of [1280, 390] as const) {
    test(`3. a ${largura} px: o Fechamento reaberto mostra o contrato da 2ª estadia`, async ({ browser }) => {
      const page = await noFechamento(browser, largura);
      const aviso = page.getByTestId("fechamento-contrato-existente");
      await expect(aviso).toContainText("Esta candidatura já tem contrato.", { timeout: 20_000 });
      await expect(aviso.getByRole("link", { name: "Ver contrato" })).toHaveAttribute("href", new RegExp(ids.c2!));
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${largura} px: sem rolagem lateral`).toBeLessThanOrEqual(1);
      await aviso.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t1726-3-fechamento-reaberto-${largura}.png` });
      await page.context().close();
    });
  }
});
