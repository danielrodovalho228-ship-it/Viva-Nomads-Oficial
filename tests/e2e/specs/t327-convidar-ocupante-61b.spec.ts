// Portão pós-#1500 (Pista C, 29/10): o E193 (#1496) trocou listas e caixas por pílulas e cartões no assistente e no editor; roda no lab-crítico deste PR.
import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, lerSaida, liberarLimiteCodigo, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T327 — 61-B: dados que faltavam da análise do Airbnb.
 *   1. o anúncio publicado sem tipo de entrada segue no ar com o aviso no painel; o dono informa o tipo, o recado para
 *      quem pede (com contato, que é escondido) e "o que considerar" no editor → o morador lê o recado no pedido (1280 / 390);
 *   2. o morador convida quem vai morar junto → 1 e-mail sem valor → o convidado entra por código e vê SÓ LEITURA:
 *      datas, endereço, instruções (D-7) e linha do tempo; nada de valores; a página da estadia leva à visão dele (390);
 *   3. o morador remove o convite → o acesso cai na hora (404).
 */
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t327.${sufixo}@lab.vivanomads.test`, nome: "Dora Chegada", role: "owner" as const };
const morador = { email: `mor.t327.${sufixo}@lab.vivanomads.test`, nome: "Mauro Chegada", role: "tenant" as const };
// Quem ainda vai pedir (sem pedido nem contrato neste imóvel): é quem vê o botão "Solicitar".
const interessada = { email: `int.t327.${sufixo}@lab.vivanomads.test`, nome: "Iara Pedido", role: "tenant" as const };
const convidado = `conv.t327.${sufixo}@lab.vivanomads.test`;
const titulo = `Studio da chegada ${sufixo}`;
const ids: { dono?: string; morador?: string; interessada?: string; convidado?: string; imovel?: string; lead?: string; contrato?: string; bloco1?: string } = {};

const dia = (n: number) => new Date(Date.now() - 3 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);
const hrefEstadia = () => `/dashboard/estadia/${ids.contrato}`;

function semDialogo(page: Page) {
  page.on("dialog", (d) => {
    throw new Error(`diálogo do navegador não permitido: ${d.type()} ${d.message()}`);
  });
}
async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}
async function abrir(browser: Browser, email: string, largura: number): Promise<Page> {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  semDialogo(page);
  return page;
}
async function emailsPara(email: string) {
  return (await lerSaida()).filter((l) => l.servico === "email" && l.para === email) as { assunto?: string; corpo?: string }[];
}

test.describe("T327 — 61-B: tipo de entrada, recado para quem pede e convidar quem mora junto", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.interessada = await criarConta(interessada, senha);
    ids.imovel = await criarImovelPronto(ids.dono, titulo, { ativo: true, preco: 3000, semTipoEntrada: true });
    await adm().from("properties").update({ exact_address: "Rua das Acácias, 120, Apto 31" }).eq("id", ids.imovel); // consistency-ignore: massa do laboratório
    await adm().from("imovel_instrucoes_chegada").upsert({ property_id: ids.imovel, como_entrar: "Cofre na caixa de luz, senha 4821" });
    ids.lead = await criarLead(ids.dono, ids.morador, ids.imovel, true);
    const agora = new Date().toISOString();
    const { data: c, error } = await adm()
      .from("contratos")
      .insert({
        lead_id: ids.lead, property_id: ids.imovel, tenant_id: ids.morador, owner_plan: "essential", faixa: "media_estadia",
        prazo_total_dias: 60, aluguel_mensal: 3000, tamanho_bloco_meses: 2, comissao_percent: 0.1, comissao_valor: 600,
        qtd_ocupantes: 2, capacidade_snapshot: 3, assinado_proprietario_em: agora, assinado_inquilino_em: agora,
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = c.id as string;
    // Entrada em 5 dias (instruções já liberadas no D-7) e o 1º pagamento registrado.
    const { data: b1, error: e1 } = await adm()
      .from("contrato_blocos")
      .insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: dia(5), fim: dia(64), meses: 2, valor: 6000, caucao: 3000, status: "ativo" })
      .select("id")
      .single();
    if (e1) throw e1;
    ids.bloco1 = b1.id as string;
    await adm().from("pagamentos_bloco").insert({ bloco_id: ids.bloco1, contrato_id: ids.contrato, tipo: "aluguel", valor: 3000, data_pagamento: dia(0), marcado_por: ids.dono, confirmado_pelo_inquilino: true, confirmado_em: agora });
  });

  test.afterAll(async () => {
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    if (ids.lead) await adm().from("leads").delete().eq("id", ids.lead);
    await apagarContas([ids.dono, ids.morador, ids.interessada, ids.convidado].filter((x): x is string => !!x));
  });

  test("1. aviso no painel → dono informa tipo, recado e o que considerar → morador lê o recado no pedido", async ({ browser }) => {
    test.setTimeout(150_000);
    const d = await abrir(browser, dono.email, 1280);
    // Publicado sem tipo de entrada: segue no ar (sem bloqueio retroativo) e ganha o aviso.
    await d.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("aviso-tipo-entrada")).toContainText(titulo, { timeout: 20_000 });
    expect((await adm().from("properties").select("status").eq("id", ids.imovel!).single()).data?.status).toBe("active");

    await d.goto(`/dashboard/imoveis/${ids.imovel}/editar`, { waitUntil: "domcontentloaded" });
    const secao = d.getByTestId("secao-regras");
    await expect(async () => {
      if ((await secao.getAttribute("data-aberta")) !== "true") await secao.getByRole("button").first().click({ timeout: 3_000 });
      await expect(secao.getByTestId("chegada-e-pedido")).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    await secao.getByTestId("tipo-entrada-cofre_de_chaves").check();
    await secao.getByTestId("mensagem-para-pedido").fill("Prefiro estadias de 3 meses ou mais. Qualquer coisa, whats 34 99876-5432.");
    await secao.getByTestId("considerar-barulho").check();
    await secao.getByTestId("considerar-texto").fill("Rua com bares às sextas.");
    await semRolagemLateral(d);
    await d.screenshot({ path: `${SAIDA}/t327-editor-chegada-1280.png`, fullPage: true });
    await secao.getByRole("button", { name: "Salvar seção" }).click();
    await expect
      .poll(async () => (await adm().from("properties").select("tipo_entrada").eq("id", ids.imovel!).single()).data?.tipo_entrada, { timeout: 20_000 })
      .toBe("cofre_de_chaves");
    const { data: linha } = await adm().from("properties").select("mensagem_para_pedido, considerar_antes, considerar_antes_texto").eq("id", ids.imovel!).single();
    expect(linha!.mensagem_para_pedido).toContain("Prefiro estadias de 3 meses");
    expect(linha!.mensagem_para_pedido).not.toContain("99876");
    expect(linha!.considerar_antes).toEqual(["barulho"]);
    expect(linha!.considerar_antes_texto).toBe("Rua com bares às sextas.");
    await d.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("aviso-tipo-entrada")).toHaveCount(0);
    await d.context().close();

    // Quem vai pedir lê o recado do dono antes de escrever a apresentação (a mesma etapa "Mensagem" do pedido).
    const m = await abrir(browser, interessada.email, 390);
    await m.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
    const passo = m.getByTestId("solicitacao-passo");
    await expect(async () => {
      await m.getByRole("button", { name: "Solicitar", exact: true }).locator("visible=true").first().click();
      await expect(passo).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    await passo.getByRole("button", { name: "Continuar" }).click();
    const recado = passo.getByTestId("mensagem-do-dono");
    await expect(recado).toContainText("Prefiro estadias de 3 meses ou mais.");
    await expect(recado).not.toContainText("99876");
    await expect(passo.getByTestId("candidatura-apresentacao")).toBeVisible();
    await semRolagemLateral(m);
    await m.screenshot({ path: `${SAIDA}/t327-recado-no-pedido-390.png`, fullPage: true });
    await m.context().close();
  });

  test("2. morador convida → 1 e-mail sem valor → convidado entra por código e vê só leitura", async ({ browser }) => {
    test.setTimeout(180_000);
    const m = await abrir(browser, morador.email, 1280);
    await m.goto(hrefEstadia(), { waitUntil: "domcontentloaded" });
    const bloco = m.getByTestId("convidar-ocupante");
    await expect(bloco).toBeVisible({ timeout: 20_000 });
    // O próprio e-mail não vale.
    await bloco.getByTestId("convidado-email").fill(morador.email);
    await bloco.getByTestId("convidado-enviar").click();
    await expect(bloco.getByTestId("estadia-erro")).toHaveText("Esse é o seu próprio e-mail.");
    await bloco.getByTestId("convidado-email").fill(convidado);
    await bloco.getByTestId("convidado-enviar").click();
    await expect(bloco.getByTestId("estadia-ok")).toHaveText("Convite enviado por e-mail.");
    await expect(bloco.getByTestId("convidado-item")).toContainText(`${convidado} · ainda não entrou`);
    // Contrato para 2: o morador + 1 convidado. Sem vaga, o campo some.
    await expect(bloco.getByTestId("convidados-sem-vaga")).toBeVisible();
    await m.screenshot({ path: `${SAIDA}/t327-convidar-1280.png`, fullPage: true });

    // Um e-mail só, sem valor nem endereço, com o caminho da entrada por código.
    await expect.poll(async () => (await emailsPara(convidado)).length, { timeout: 20_000 }).toBe(1);
    const convite = (await emailsPara(convidado))[0];
    expect(convite.assunto).toContain("Você foi incluído em uma estadia na Viva");
    expect(convite.corpo).not.toMatch(/R\$|3\.000|Acácias|Cofre/);

    // O convidado entra com o e-mail (código do 49) e cai na visão de leitura.
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const c = await ctx.newPage();
    semDialogo(c);
    await liberarLimiteCodigo();
    await c.goto(`/auth?redirect=${encodeURIComponent(`${hrefEstadia()}/convidado`)}`, { waitUntil: "domcontentloaded" });
    const tela = c.getByTestId("login-por-codigo");
    await expect(async () => {
      if (await c.getByTestId("campo-codigo").isVisible()) return;
      const campo = tela.getByPlaceholder("E-mail");
      if ((await campo.inputValue({ timeout: 4_000 })) !== convidado) await campo.fill(convidado, { timeout: 4_000 });
      await tela.getByRole("button", { name: "Continuar" }).click({ timeout: 4_000 });
      await expect(c.getByTestId("campo-codigo")).toBeVisible({ timeout: 8_000 });
    }).toPass({ timeout: 45_000 });
    await expect.poll(async () => (await emailsPara(convidado)).length, { timeout: 20_000 }).toBe(2);
    const codigo = (await emailsPara(convidado))[1].corpo?.match(/Seu código: (\d{6})/)?.[1] ?? "";
    expect(codigo).toMatch(/^\d{6}$/);
    await c.getByTestId("campo-codigo").fill(codigo);
    await c.getByRole("button", { name: "Entrar", exact: true }).click();
    await c.waitForURL(/\/auth\/intencao|\/convidado/, { timeout: 45_000 });
    if (c.url().includes("/auth/intencao")) {
      await c.getByTestId("tela-intencao").getByTestId("intencao-morar").click();
      await c.getByTestId("tela-intencao").getByTestId("intencao-continuar").click();
    }
    await c.waitForURL(/\/convidado$/, { timeout: 45_000 });
    const { data: usuarios } = await adm().auth.admin.listUsers({ page: 1, perPage: 1000 });
    ids.convidado = usuarios.users.find((u) => u.email === convidado)?.id;

    const pagina = c.getByTestId("pagina-estadia-convidado");
    await expect(pagina).toBeVisible({ timeout: 20_000 });
    await expect(c.getByTestId("convidado-endereco")).toContainText("Rua das Acácias, 120");
    await expect(c.getByTestId("convidado-instrucoes-liberadas")).toContainText("Cofre na caixa de luz");
    await expect(pagina).not.toContainText("R$");
    await expect(c.getByTestId("estadia-valores")).toHaveCount(0);
    await expect(c.getByTestId("estadia-notas")).toHaveCount(0);
    await expect(c.getByTestId("estadia-documentos")).toHaveCount(0);
    await semRolagemLateral(c);
    await c.screenshot({ path: `${SAIDA}/t327-visao-convidado-390.png`, fullPage: true });
    // O convite ficou ligado à conta.
    expect((await adm().from("estadia_convidados").select("convidado_user_id").eq("contrato_id", ids.contrato!).single()).data?.convidado_user_id).toBe(ids.convidado);
    // A página da estadia (das partes) leva à visão de leitura; a conversa do contrato não abre.
    await c.goto(hrefEstadia(), { waitUntil: "domcontentloaded" });
    await c.waitForURL(/\/convidado$/, { timeout: 20_000 });
    for (const rota of ["/alteracao", "/ocupantes", "/encerrar"]) {
      const r = await c.goto(`${hrefEstadia()}${rota}`, { waitUntil: "domcontentloaded" });
      expect(r?.status(), `convidado em ${rota}`).toBe(404);
    }
    await c.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    await expect(c.locator("body")).not.toContainText(titulo);
    await ctx.close();

    // O morador vê que o convidado já entrou.
    await m.reload({ waitUntil: "domcontentloaded" });
    await expect(m.getByTestId("convidado-item")).toContainText("já entrou", { timeout: 20_000 });
    await m.context().close();
  });

  test("3. morador remove → o acesso do convidado cai na hora", async ({ browser }) => {
    test.setTimeout(150_000);
    const m = await abrir(browser, morador.email, 390);
    await m.goto(hrefEstadia(), { waitUntil: "domcontentloaded" });
    const bloco = m.getByTestId("convidar-ocupante");
    await bloco.getByTestId("convidado-remover").click();
    await expect(bloco.getByTestId("estadia-ok")).toHaveText("Convite removido. O acesso dessa pessoa acabou agora.");
    await expect(bloco.getByTestId("convidado-item")).toHaveCount(0);
    await expect(bloco.getByTestId("convidado-email")).toBeVisible();
    await semRolagemLateral(m);
    await m.screenshot({ path: `${SAIDA}/t327-removido-390.png`, fullPage: true });
    await m.context().close();
    expect((await adm().from("estadia_convidados").select("removido_em").eq("contrato_id", ids.contrato!).single()).data?.removido_em).toBeTruthy();

    // O convidado (a mesma conta) não abre mais nada da estadia.
    const { data: link } = await adm().auth.admin.generateLink({ type: "magiclink", email: convidado });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const c = await ctx.newPage();
    await c.goto(`/auth/confirm?token_hash=${link!.properties!.hashed_token}&type=magiclink&next=/dashboard`, { waitUntil: "domcontentloaded" });
    await c.waitForURL(/\/dashboard|\/auth\/(intencao|pronto)/, { timeout: 30_000 });
    for (const rota of ["/convidado", ""]) {
      const r = await c.goto(`${hrefEstadia()}${rota}`, { waitUntil: "domcontentloaded" });
      expect(r?.status(), `removido em ${rota || "/"}`).toBe(404);
    }
    await ctx.close();
  });
});
