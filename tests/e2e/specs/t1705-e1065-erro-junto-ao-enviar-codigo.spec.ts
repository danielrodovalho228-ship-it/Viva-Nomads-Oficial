import { test, expect, type Locator, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { areaDeToque } from "../fixtures/area-toque";
import { MSG_FALTAM_INSTRUCOES } from "../../../src/lib/checkin";

/*
  T1705 — E1065 @E1065: na assinatura do contrato, o motivo de o código não sair aparece JUNTO do botão "Enviar código
  por e-mail", na hora. Na prova ao vivo de 20/11 o dono clicou, nenhum e-mail saiu e ele não viu nada junto do botão:
  faltavam as instruções de entrada, e a recusa só aparecia mais abaixo, depois do campo do código.
   1. Dono, sem as instruções de entrada: o motivo e o caminho ("Preencher as instruções de entrada") estão junto do botão
      ANTES do clique, a 1280 e a 390 px. Ao clicar, a recusa aparece no mesmo lugar; nenhum e-mail sai e a tela não diz
      "Enviamos 6 números".
   2. O dono preenche as instruções pela tela: o motivo some; ao clicar, o código sai (caixa de e-mails de teste).
   3. As instruções somem DEPOIS de a página abrir (a página não sabia): o clique não fica mudo — a recusa aparece junto
      do botão do código.
   4. Moradora, sem as instruções: nenhum motivo (a regra é só do dono); o código sai.
   5. O erro de "Assinar contrato" (código errado) continua junto do botão de assinar, não junto do botão do código.
  Capturas a 390 e a 1280 px da área do botão do código (caso 1, antes e depois do clique). Laboratório; não é prova ao vivo.
*/
const SAIDA = "tests/laboratorio/saida";
const emDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

interface Caso {
  dono: string;
  inq: string;
  contrato: string;
  senha: string;
  emailDono: string;
  emailInq: string;
}
const criados: { contas: string[]; contratos: string[] } = { contas: [], contratos: [] };

/** Dono, moradora, imóvel e um contrato aguardando assinatura. As instruções de entrada entram só quando pedido. */
async function contratoParaAssinar(opcoes: { comInstrucoes: boolean }): Promise<Caso> {
  const senha = novaSenha();
  const sufixo = novoSufixo();
  const dono = { email: `dono.t1705.${sufixo}@lab.vivanomads.test`, nome: "Dora Codigo Sobrenome", role: "owner" as const };
  const inq = { email: `inq.t1705.${sufixo}@lab.vivanomads.test`, nome: "Iris Codigo Sobrenome", role: "tenant" as const };
  const idDono = await criarConta(dono, senha);
  const idInq = await criarConta(inq, senha);
  criados.contas.push(idDono, idInq);
  // Conta de teste: o e-mail do código vai para a caixa dela (emails_teste), que o próprio teste lê.
  const { error: eTeste } = await adm().from("profiles").update({ is_teste: true }).in("id", [idDono, idInq]);
  if (eTeste) throw eTeste;
  const imovel = await criarImovelPronto(idDono, `[TESTE QA] Studio código ${sufixo}`, { ativo: true, preco: 3200 });
  const { data, error } = await adm()
    .from("contratos")
    .insert({ property_id: imovel, tenant_id: idInq, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 256, qtd_ocupantes: 1, status: "ativo", garantia: "caucao" })
    .select("id")
    .single();
  if (error) throw error;
  const contrato = data.id as string;
  criados.contratos.push(contrato);
  const { error: eBloco } = await adm()
    .from("contrato_blocos")
    .insert({ contrato_id: contrato, numero_bloco: 1, inicio: emDias(30), fim: emDias(89), meses: 2, valor: 6400, caucao: 3200, status: "ativo" });
  if (eBloco) throw eBloco;
  if (opcoes.comInstrucoes) await gravarInstrucoes(contrato);
  return { dono: idDono, inq: idInq, contrato, senha, emailDono: dono.email, emailInq: inq.email };
}

async function gravarInstrucoes(contrato: string) {
  const { error } = await adm().from("contratos_checkin").insert({ contrato_id: contrato, horario: "14:00", instrucoes: "Chave na portaria, apto 12.", plantao: "34999990000" });
  if (error) throw error;
}

const codigosNaCaixa = async (usuario: string) =>
  ((await adm().from("emails_teste").select("id").eq("usuario_id", usuario).eq("evento", "contract_signature_code")).data ?? []).length;

/** O alvo e o botão do código cabem inteiros na mesma tela — é o que "junto do botão" quer dizer para quem clica. */
async function naMesmaTelaDoBotao(page: Page, alvo: Locator, mensagem: string) {
  const botao = page.getByTestId("assinar-pedir-codigo");
  // Centra a área do botão (botão + motivo + caminho): sem isto, um alvo logo abaixo do botão pode ficar cortado pela
  // borda da tela por poucos pixels só porque a página não tinha rolado.
  await juntoDoBotaoDoCodigo(page).evaluate((el) => el.scrollIntoView({ block: "center" }));
  await expect(alvo, mensagem).toBeInViewport({ ratio: 1 });
  await expect(botao, `${mensagem} (o botão continua à vista)`).toBeInViewport({ ratio: 1 });
}

/**
 * ORDEM-DUET-348/349: a âncora é o botão "Enviar código por e-mail". "Junto do botão" é o bloco em que ele está; o
 * motivo e a recusa são procurados ali por papel (status, alert) e texto, sem depender de marcação nova.
 */
const juntoDoBotaoDoCodigo = (page: Page) => page.getByRole("button", { name: /^Enviar (outro )?código/ }).locator("xpath=..");

/** Clica e espera o pedido acabar (o botão gira e volta). */
async function pedirCodigo(page: Page) {
  const botao = page.getByTestId("assinar-pedir-codigo");
  await botao.scrollIntoViewIfNeeded();
  await botao.click();
  await expect(botao, "o botão volta depois do pedido").toHaveText(/Enviar (outro )?código/, { timeout: 40_000 });
  await expect(botao).toBeEnabled();
}

test.describe("T1705 — E1065: o motivo de o código não sair fica junto do botão @E1065", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.setTimeout(180_000);

  test.afterAll(async () => {
    for (const contrato of criados.contratos) await adm().from("contratos").delete().eq("id", contrato);
    await apagarContas(criados.contas);
  });

  test("1. dono sem as instruções de entrada: o motivo está junto do botão antes do clique e a recusa aparece ali", async ({ browser }) => {
    const c = await contratoParaAssinar({ comInstrucoes: false });
    const page = await entrar(browser, c.emailDono, c.senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/dashboard/contratos/${c.contrato}`, { waitUntil: "domcontentloaded" });
    const area = juntoDoBotaoDoCodigo(page);
    const pendencia = area.getByRole("status").filter({ hasText: MSG_FALTAM_INSTRUCOES });
    await expect(pendencia, "antes do clique, o motivo já está junto do botão").toHaveText(MSG_FALTAM_INSTRUCOES, { timeout: 30_000 });
    const caminho = area.getByRole("link", { name: "Preencher as instruções de entrada" });
    await expect(caminho).toHaveAttribute("href", "#checkin-painel");
    for (const [largura, altura] of [[1280, 900], [390, 844]] as const) {
      await page.setViewportSize({ width: largura, height: altura });
      await naMesmaTelaDoBotao(page, pendencia, `${largura} px: o motivo cabe na mesma tela do botão`);
      await naMesmaTelaDoBotao(page, caminho, `${largura} px: o caminho cabe na mesma tela do botão`);
      await area.screenshot({ path: `${SAIDA}/t1705-1-antes-do-clique-${largura}.png` });
    }
    expect((await areaDeToque(caminho)).faltam, "o link tem área de toque de 44 × 44").toEqual([]);

    await pedirCodigo(page);
    const erro = area.getByRole("alert").filter({ hasText: MSG_FALTAM_INSTRUCOES });
    await expect(erro, "depois do clique, a recusa está junto do botão").toHaveText(MSG_FALTAM_INSTRUCOES);
    await expect(pendencia, "um motivo só, não o mesmo texto duas vezes").toHaveCount(0);
    await expect(page.getByTestId("assinar-pedir-codigo")).toHaveText("Enviar código por e-mail");
    await expect(page.getByTestId("assinar-codigo-enviado"), "a tela não diz que enviou").toHaveCount(0);
    await naMesmaTelaDoBotao(page, erro, "390 px: a recusa cabe na mesma tela do botão");
    await area.screenshot({ path: `${SAIDA}/t1705-1-depois-do-clique-390.png` });
    await page.setViewportSize({ width: 1280, height: 900 });
    await naMesmaTelaDoBotao(page, erro, "1280 px: a recusa cabe na mesma tela do botão");
    await area.screenshot({ path: `${SAIDA}/t1705-1-depois-do-clique-1280.png` });
    // A recusa do pedido do código não fica (também) longe, junto do botão de assinar.
    await expect(page.getByTestId("form-assinar").getByRole("alert").filter({ hasText: MSG_FALTAM_INSTRUCOES }), "a recusa aparece uma vez só, junto do botão do código").toHaveCount(1);
    expect(await codigosNaCaixa(c.dono), "nenhum e-mail de código saiu").toBe(0);
    await page.context().close();
  });

  test("2. o dono preenche as instruções pela tela: o motivo some e o código sai", async ({ browser }) => {
    const c = await contratoParaAssinar({ comInstrucoes: false });
    const page = await entrar(browser, c.emailDono, c.senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/dashboard/contratos/${c.contrato}`, { waitUntil: "domcontentloaded" });
    const area = juntoDoBotaoDoCodigo(page);
    await expect(area.getByRole("status").filter({ hasText: MSG_FALTAM_INSTRUCOES })).toBeVisible({ timeout: 30_000 });
    // O caminho leva à seção das instruções, na mesma página.
    await area.getByRole("link", { name: "Preencher as instruções de entrada" }).click();
    const form = page.getByTestId("checkin-form");
    await expect(form).toBeInViewport();
    await form.locator('input[type="time"]').fill("14:00");
    await form.getByTestId("checkin-instrucoes").fill("Chave na portaria, apto 12.");
    await form.locator('input[type="tel"]').fill("34999990000");
    await form.getByTestId("checkin-salvar").click();
    await expect(area.getByRole("status").filter({ hasText: MSG_FALTAM_INSTRUCOES }), "com as instruções gravadas, o motivo some").toHaveCount(0, { timeout: 30_000 });

    await pedirCodigo(page);
    await expect(area.getByRole("alert").filter({ hasText: MSG_FALTAM_INSTRUCOES })).toHaveCount(0);
    await expect(page.getByTestId("assinar-codigo-enviado")).toBeVisible();
    await expect.poll(() => codigosNaCaixa(c.dono), { timeout: 30_000, message: "o código chega à caixa de teste do dono" }).toBe(1);
    await page.context().close();
  });

  test("3. as instruções somem depois de a página abrir: o clique não fica mudo", async ({ browser }) => {
    const c = await contratoParaAssinar({ comInstrucoes: true });
    const page = await entrar(browser, c.emailDono, c.senha);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/dashboard/contratos/${c.contrato}`, { waitUntil: "domcontentloaded" });
    const area = juntoDoBotaoDoCodigo(page);
    await expect(page.getByTestId("assinar-pedir-codigo")).toBeVisible({ timeout: 30_000 });
    await expect(area.getByRole("status").filter({ hasText: MSG_FALTAM_INSTRUCOES }), "a página abriu com as instruções preenchidas").toHaveCount(0);
    const { error } = await adm().from("contratos_checkin").delete().eq("contrato_id", c.contrato);
    if (error) throw error;

    await pedirCodigo(page);
    const erro = area.getByRole("alert").filter({ hasText: MSG_FALTAM_INSTRUCOES });
    await expect(erro).toHaveText(MSG_FALTAM_INSTRUCOES);
    await naMesmaTelaDoBotao(page, erro, "390 px: a recusa cabe na mesma tela do botão");
    await expect(page.getByTestId("assinar-codigo-enviado")).toHaveCount(0);
    expect(await codigosNaCaixa(c.dono)).toBe(0);
    await page.context().close();
  });

  test("4. moradora sem as instruções: nenhum motivo junto do botão e o código sai", async ({ browser }) => {
    const c = await contratoParaAssinar({ comInstrucoes: false });
    const page = await entrar(browser, c.emailInq, c.senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/dashboard/locacoes/${c.contrato}`, { waitUntil: "domcontentloaded" });
    const area = juntoDoBotaoDoCodigo(page);
    await expect(page.getByTestId("assinar-pedir-codigo")).toBeVisible({ timeout: 30_000 });
    await expect(area.getByRole("status").filter({ hasText: MSG_FALTAM_INSTRUCOES })).toHaveCount(0);

    await pedirCodigo(page);
    await expect(area.getByRole("alert").filter({ hasText: MSG_FALTAM_INSTRUCOES })).toHaveCount(0);
    await expect(page.getByTestId("assinar-codigo-enviado")).toBeVisible();
    await expect.poll(() => codigosNaCaixa(c.inq), { timeout: 30_000 }).toBe(1);
    await page.context().close();
  });

  test("5. o erro de \"Assinar contrato\" continua junto do botão de assinar", async ({ browser }) => {
    const c = await contratoParaAssinar({ comInstrucoes: true });
    const page = await entrar(browser, c.emailInq, c.senha);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/dashboard/locacoes/${c.contrato}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("form-assinar")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("assinar-aceite").check();
    await page.getByTestId("assinar-codigo").fill("000000");
    const assinar = page.getByTestId("assinar-enviar");
    await assinar.click();
    // ORDEM-DUET-348: o alerta é procurado por papel e texto, dentro do formulário (não depende de marcação nova).
    const erro = page.getByTestId("form-assinar").getByRole("alert").filter({ hasText: /código/i });
    await expect(erro).toBeVisible({ timeout: 30_000 });
    await expect(juntoDoBotaoDoCodigo(page).getByRole("alert"), "o erro de assinar não vai para junto do botão do código").toHaveCount(0);
    await assinar.scrollIntoViewIfNeeded();
    await expect(erro, "o erro de assinar cabe na mesma tela do botão de assinar").toBeInViewport({ ratio: 1 });
    await page.context().close();
  });
});
