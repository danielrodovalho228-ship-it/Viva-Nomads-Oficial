import { test, expect, type Browser, type Locator, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { areaDeToque } from "../fixtures/area-toque";
import { LINK_DOCUMENTO, MSG_DOCUMENTO } from "../../../src/lib/documento-pessoa";
import { MSG_DOCS_INQUILINO } from "../../../src/lib/documentos-inquilino";

/*
  T1704 — E1063 @E1063: quando falta massa, o motivo de o contrato não sair aparece JUNTO do botão "Gerar contrato para
  assinatura" — não só no aviso do topo da página, que fica fora da tela quando o dono está no passo do contrato.
  Na prova ao vivo de 20/11 o botão mostrou "Gerando..." e voltou, e o dono não viu o motivo no passo.
   1. Falta o documento da moradora: o motivo está junto do botão ANTES do clique, a 1280 e a 390 px, na mesma tela do
      botão. Depois do clique o botão volta, o motivo continua ali e nenhum contrato é gravado.
   2. Falta o CPF do dono: o motivo e o caminho ("Informar meu documento") estão junto do botão, antes e depois do clique.
   3. A massa some DEPOIS de a página abrir (a página não sabia): o clique não fica mudo — o motivo aparece junto do botão.
   4. Massa completa: nenhum motivo junto do botão; o contrato é gerado.
  Capturas a 390 e a 1280 px da área do botão (caso 1, antes e depois do clique). Laboratório; não é prova ao vivo no site.
*/
const SAIDA = "tests/laboratorio/saida";
const ROTULO_BOTAO = "Gerar contrato para assinatura";
const emDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

interface Caso {
  dono: string;
  inq: string;
  lead: string;
  page: Page;
}
const criados: { contas: string[]; leads: string[]; imoveis: string[] } = { contas: [], leads: [], imoveis: [] };

async function abrir(page: Page, rota: string) {
  await page.goto(rota, { waitUntil: "domcontentloaded" });
  await page.locator("main").first().waitFor();
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}

/** Monta dono, moradora, imóvel e candidatura aceita; leva o dono até o passo do contrato (a minuta). */
async function ateOPassoDoContrato(browser: Browser, falta: { documentosDaMoradora?: boolean; cpfDoDono?: boolean }): Promise<Caso> {
  const senha = novaSenha();
  const sufixo = novoSufixo();
  const dono = { email: `dono.t1704.${sufixo}@lab.vivanomads.test`, nome: "Dora Motivo Sobrenome", role: "owner" as const };
  const inq = { email: `inq.t1704.${sufixo}@lab.vivanomads.test`, nome: "Iris Motivo Sobrenome", role: "tenant" as const };
  const idDono = await criarConta(dono, senha);
  const idInq = await criarConta(inq, senha);
  criados.contas.push(idDono, idInq);
  // Contas de teste: o contrato sai no modo TESTE (sem assinatura digital real).
  await adm().from("profiles").update({ is_teste: true }).in("id", [idDono, idInq]);
  if (falta.cpfDoDono) {
    const { error } = await adm().from("profiles").update({ cpf: null }).eq("id", idDono);
    if (error) throw error;
  }
  const imovel = await criarImovelPronto(idDono, `[TESTE QA] Studio motivo ${sufixo}`, { ativo: true, preco: 2800 });
  criados.imoveis.push(imovel);
  const { error: e1 } = await adm()
    .from("properties")
    .update({ condo_fee: 0, utilities_mode: "fixed", utilities_estimate: 250, prep_fee: 300, checkout_cleaning_enabled: false, checkout_cleaning_fee: 0, limpeza_estadia: null, min_period_days: 30, max_period_days: 180 })
    .eq("id", imovel);
  if (e1) throw e1;
  const { data, error } = await adm()
    .from("leads")
    .insert({ owner_id: idDono, tenant_id: idInq, property_id: imovel, status: "accepted", inicio_desejado: emDias(30), fim_desejado: emDias(90) })
    .select("id")
    .single();
  if (error) throw error;
  const lead = data.id as string;
  criados.leads.push(lead);
  if (!falta.documentosDaMoradora) await enviarDocumentos(lead, idInq);

  const page = await entrar(browser, dono.email, senha);
  await page.setViewportSize({ width: 1280, height: 900 });
  await abrir(page, `/dashboard/fechamento?c=${lead}`);
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
  return { dono: idDono, inq: idInq, lead, page };
}

async function enviarDocumentos(lead: string, inq: string) {
  for (const tipo of ["identidade", "vinculo"]) {
    const u = () => crypto.randomUUID();
    const { error } = await adm().from("documentos_inquilino").insert({ lead_id: lead, tenant_id: inq, tipo, caminho: `${u()}/${u()}/${u()}.pdf`, hash_sha256: "a".repeat(64) });
    if (error) throw error;
  }
}

/** O alvo cabe inteiro na tela quando o botão está à vista — é o que "junto do botão" quer dizer para quem clica. */
async function naMesmaTelaDoBotao(page: Page, alvo: Locator, mensagem: string) {
  const botao = page.getByTestId("fechamento-gerar-contrato");
  await botao.scrollIntoViewIfNeeded();
  await expect(alvo, mensagem).toBeInViewport({ ratio: 1 });
  await expect(botao, `${mensagem} (o botão continua à vista)`).toBeInViewport({ ratio: 1 });
}

const contratosDoLead = async (lead: string) => ((await adm().from("contratos").select("id").eq("lead_id", lead)).data ?? []).length;

/** Clica e espera o pedido acabar: o botão passa por "Gerando..." e volta ao rótulo (o contrato não saiu). */
async function clicarEVoltar(page: Page) {
  const botao = page.getByTestId("fechamento-gerar-contrato");
  await botao.scrollIntoViewIfNeeded();
  await botao.click();
  await expect(botao, "o botão volta depois da recusa").toHaveText(ROTULO_BOTAO, { timeout: 40_000 });
  await expect(botao).toBeEnabled();
}

test.describe("T1704 — E1063: o motivo de o contrato não sair fica junto do botão @E1063", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.setTimeout(240_000);

  test.afterAll(async () => {
    for (const lead of criados.leads) {
      await adm().from("cobrancas_fechamento").delete().eq("lead_id", lead);
      await adm().from("contratos").delete().eq("lead_id", lead);
    }
    for (const imovel of criados.imoveis) await adm().from("messages").delete().eq("property_id", imovel);
    await apagarContas(criados.contas);
  });

  test("1. falta o documento da moradora: o motivo está junto do botão antes do clique e continua depois dele", async ({ browser }) => {
    const c = await ateOPassoDoContrato(browser, { documentosDaMoradora: true });
    const { page } = c;
    const area = page.getByTestId("acao-gerar-contrato");
    const pendencia = area.getByTestId("pendencia-contrato");
    await expect(pendencia, "antes do clique, o motivo já está junto do botão").toHaveText(MSG_DOCS_INQUILINO);
    for (const [largura, altura] of [[1280, 900], [390, 844]] as const) {
      await page.setViewportSize({ width: largura, height: altura });
      await naMesmaTelaDoBotao(page, pendencia, `${largura} px: o motivo cabe na mesma tela do botão`);
      await area.screenshot({ path: `${SAIDA}/t1704-1-antes-do-clique-${largura}.png` });
    }
    // O aviso do topo existe, mas fica fora da tela neste passo — por isso o motivo tem de estar junto do botão.
    await expect(page.getByTestId("documento-pendente")).not.toBeInViewport();

    await clicarEVoltar(page);
    const erro = area.getByTestId("erro-contrato");
    await expect(erro, "depois do clique, o motivo da recusa está junto do botão").toHaveText(MSG_DOCS_INQUILINO);
    // Um motivo só, não o mesmo texto duas vezes.
    await expect(pendencia).toHaveCount(0);
    await naMesmaTelaDoBotao(page, erro, "390 px: a recusa cabe na mesma tela do botão");
    await area.screenshot({ path: `${SAIDA}/t1704-1-depois-do-clique-390.png` });
    await page.setViewportSize({ width: 1280, height: 900 });
    await naMesmaTelaDoBotao(page, erro, "1280 px: a recusa cabe na mesma tela do botão");
    await area.screenshot({ path: `${SAIDA}/t1704-1-depois-do-clique-1280.png` });
    expect(await contratosDoLead(c.lead), "nenhum contrato foi gravado").toBe(0);
    await page.context().close();
  });

  test("2. falta o CPF do dono: o motivo e o caminho para resolver estão junto do botão", async ({ browser }) => {
    const c = await ateOPassoDoContrato(browser, { cpfDoDono: true });
    const { page } = c;
    const area = page.getByTestId("acao-gerar-contrato");
    await expect(area.getByTestId("pendencia-contrato")).toHaveText(MSG_DOCUMENTO.fecharDono);
    const caminho = area.getByRole("link", { name: "Informar meu documento" });
    await expect(caminho).toHaveAttribute("href", LINK_DOCUMENTO);
    await page.setViewportSize({ width: 390, height: 844 });
    await naMesmaTelaDoBotao(page, caminho, "390 px: o caminho cabe na mesma tela do botão");
    expect((await areaDeToque(caminho)).faltam, "o link tem área de toque de 44 × 44").toEqual([]);

    await clicarEVoltar(page);
    await expect(area.getByTestId("erro-contrato")).toHaveText(MSG_DOCUMENTO.fecharDono);
    await expect(caminho, "o caminho continua junto do botão depois da recusa").toBeVisible();
    expect(await contratosDoLead(c.lead)).toBe(0);
    await page.context().close();
  });

  test("3. a massa some depois de a página abrir: o clique não fica mudo", async ({ browser }) => {
    const c = await ateOPassoDoContrato(browser, {});
    const { page } = c;
    // ORDEM-DUET-348: a procura é na página toda (não depende da área nova); "na mesma tela do botão" continua cobrado.
    await expect(page.getByTestId("pendencia-contrato"), "a página abriu com a massa completa").toHaveCount(0);
    const { error } = await adm().from("documentos_inquilino").delete().eq("lead_id", c.lead);
    if (error) throw error;

    await page.setViewportSize({ width: 390, height: 844 });
    await clicarEVoltar(page);
    const erro = page.getByTestId("erro-contrato");
    await expect(erro).toHaveText(MSG_DOCS_INQUILINO);
    await naMesmaTelaDoBotao(page, erro, "390 px: a recusa cabe na mesma tela do botão");
    expect(await contratosDoLead(c.lead)).toBe(0);
    await page.context().close();
  });

  test("4. massa completa: nenhum motivo junto do botão e o contrato é gerado", async ({ browser }) => {
    const c = await ateOPassoDoContrato(browser, {});
    const { page } = c;
    // ORDEM-DUET-348: a procura é na página toda (não depende da área nova).
    await expect(page.getByTestId("fechamento-gerar-contrato")).toHaveText(ROTULO_BOTAO);
    await expect(page.getByTestId("pendencia-contrato")).toHaveCount(0);
    await expect(page.getByTestId("erro-contrato")).toHaveCount(0);
    await page.getByTestId("fechamento-gerar-contrato").click();
    await expect(page.getByTestId("fechamento-abrir-contrato")).toBeVisible({ timeout: 40_000 });
    await expect(page.getByTestId("erro-contrato")).toHaveCount(0);
    await expect.poll(() => contratosDoLead(c.lead), { timeout: 20_000 }).toBe(1);
    await page.context().close();
  });
});
