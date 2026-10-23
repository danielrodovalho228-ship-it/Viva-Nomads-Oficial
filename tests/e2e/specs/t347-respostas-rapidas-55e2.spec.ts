import { existsSync, readFileSync } from "node:fs";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T347 — Prompt 55-E2: respostas rápidas e mensagens programadas do dono.
 *   1. respostas salvas: telefone no texto BLOQUEIA ao salvar; na conversa, a mensagem do anúncio (61-B) vem primeiro e
 *      1 toque põe o texto no campo; contato acrescentado à resposta BLOQUEIA ao enviar; a limpa sai;
 *   2. mensagens programadas na estadia: 3 modelos, texto editável, contato bloqueado; horário do modelo;
 *   3. o passo do cron com data simulada: antes da hora espera, entre 22h e 7h espera, na hora envia na conversa;
 *   4. aditivo +1 mês reagenda a mensagem da saída (a já enviada não muda);
 *   5. contrato encerrado cancela o que não saiu.
 */
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t347.${sufixo}@lab.vivanomads.test`, nome: "Dora Respostas", role: "owner" as const };
const morador = { email: `mor.t347.${sufixo}@lab.vivanomads.test`, nome: "Mauro Respostas", role: "tenant" as const };
const ids: { dono?: string; morador?: string; imovel?: string; lead?: string; contrato?: string } = {};
const MENSAGEM_ANUNCIO = `Conte quem vai morar e por quanto tempo ${sufixo}.`;
const dia = (n: number) => new Date(Date.now() - 3 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);

function semDialogo(page: Page) {
  page.on("dialog", (d) => {
    throw new Error(`diálogo do navegador não permitido: ${d.type()} ${d.message()}`);
  });
}
async function abrir(browser: Browser, email: string, largura = 1280): Promise<Page> {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  semDialogo(page);
  return page;
}
async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}
type Linha = { id: string; quando: string; texto: string; enviar_em: string; enviada_em: string | null; cancelada_em: string | null; motivo_cancelamento: string | null; mensagem_id: string | null };
async function programadas(): Promise<Linha[]> {
  const { data } = await adm().from("mensagens_programadas").select("id, quando, texto, enviar_em, enviada_em, cancelada_em, motivo_cancelamento, mensagem_id").eq("contrato_id", ids.contrato!).order("criado_em");
  return (data ?? []) as Linha[];
}
async function tique(page: Page, agora: string) {
  const r = await page.request.get(`/api/lab/mensagens-programadas?contrato=${ids.contrato}&agora=${encodeURIComponent(agora)}`);
  expect(r.ok(), await r.text()).toBe(true);
  return (await r.json()) as { enviadas: number; canceladas: number; esperando: number };
}
async function mensagensDoDono(texto: string) {
  const { data } = await adm().from("messages").select("id, body, sender_id, receiver_id").eq("sender_id", ids.dono!).eq("receiver_id", ids.morador!).ilike("body", `%${texto}%`);
  return data ?? [];
}
async function codigoDaCaixa(usuarioId: string, depoisDe: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const { data } = await adm().from("emails_teste").select("corpo").eq("usuario_id", usuarioId).eq("evento", "contract_signature_code").gt("criado_em", depoisDe).order("criado_em", { ascending: false }).limit(1);
    const m = /":\s*(\d{6})\s*$/m.exec(String(data?.[0]?.corpo ?? "").trim());
    if (m) return m[1];
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("O código do aditivo não chegou à caixa de testes em 30 s.");
}

test.describe("T347 — Prompt 55-E2: respostas rápidas e mensagens programadas", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    // Contas de teste: o código do aditivo cai na caixa de e-mails de teste da própria conta.
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.morador]);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio respostas ${sufixo}`, { ativo: true, preco: 3000 });
    await adm().from("properties").update({ mensagem_para_pedido: MENSAGEM_ANUNCIO }).eq("id", ids.imovel);
    ids.lead = await criarLead(ids.dono, ids.morador, ids.imovel, true);
    await gravarMensagem(ids.morador, ids.dono, ids.imovel, "Oi! Qual o horário de entrada?", conversationId(ids.morador, ids.dono, ids.imovel));
    const agora = new Date().toISOString();
    const { data: c, error } = await adm()
      .from("contratos")
      .insert({
        lead_id: ids.lead, property_id: ids.imovel, tenant_id: ids.morador, owner_plan: "essential", faixa: "media_estadia",
        prazo_total_dias: 60, aluguel_mensal: 3000, tamanho_bloco_meses: 2, comissao_percent: 0.1, comissao_valor: 600,
        qtd_ocupantes: 1, capacidade_snapshot: 2, assinado_proprietario_em: agora, assinado_inquilino_em: agora, status: "ativo", garantia: "caucao",
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = c.id as string;
    const { error: eb } = await adm().from("contrato_blocos").insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: dia(10), fim: dia(69), meses: 2, valor: 6000, caucao: 3000, status: "ativo" });
    if (eb) throw eb;
  });
  test.afterEach(async ({}, info) => {
    if (info.status === info.expectedStatus) return;
    const log = `${SAIDA}/servidor.log`;
    if (existsSync(log)) console.log(`── servidor.log (fim) ──\n${readFileSync(log, "utf8").split("\n").slice(-120).join("\n")}`);
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    if (ids.lead) await adm().from("leads").delete().eq("id", ids.lead);
    await apagarContas([ids.dono, ids.morador]);
  });

  test("1. respostas rápidas: contato bloqueia ao salvar e ao enviar; a mensagem do anúncio vem primeiro", async ({ browser }) => {
    test.setTimeout(120_000);
    const d = await abrir(browser, dono.email, 390);
    await d.goto("/dashboard/respostas-rapidas", { waitUntil: "domcontentloaded" });
    await d.getByTestId("resposta-titulo").fill("Chegada");
    await d.getByTestId("resposta-texto").fill("Me chama no (34) 99876-5432 que eu explico.");
    await d.getByTestId("resposta-salvar").click();
    await expect(d.getByTestId("resposta-msg")).toContainText("Tire telefone, e-mail");
    expect((await adm().from("respostas_rapidas").select("id").eq("owner_id", ids.dono!)).data).toHaveLength(0);
    await d.getByTestId("resposta-texto").fill(`A entrada é a partir das 14h ${sufixo}.`);
    await d.getByTestId("resposta-salvar").click();
    await expect(d.getByTestId("resposta-item")).toHaveCount(1, { timeout: 20_000 });
    await expect(d.getByTestId("respostas-contagem")).toHaveText("1 de 20");
    await semRolagemLateral(d);
    await d.screenshot({ path: `${SAIDA}/t347-respostas-390.png`, fullPage: true });

    const conversa = conversationId(ids.dono!, ids.morador!, ids.imovel!);
    await d.goto(`/dashboard/mensagens?conversa=${conversa}`, { waitUntil: "domcontentloaded" });
    await d.getByTestId("respostas-rapidas-abrir").click();
    const itens = d.getByTestId("resposta-rapida-item");
    await expect(itens).toHaveCount(2, { timeout: 20_000 });
    await expect(itens.first()).toHaveAttribute("data-id", "anuncio");
    await itens.first().click();
    await expect(d.getByTestId("mensagem-campo")).toHaveValue(MENSAGEM_ANUNCIO);

    // Resposta salva + telefone acrescentado → bloqueia ao enviar (nada gravado).
    await d.getByTestId("respostas-rapidas-abrir").click();
    await itens.nth(1).click();
    await expect(d.getByTestId("mensagem-campo")).toHaveValue(`A entrada é a partir das 14h ${sufixo}.`);
    await d.getByTestId("mensagem-campo").fill(`A entrada é a partir das 14h ${sufixo}. Zap 34998765432`);
    await d.getByRole("button", { name: "Enviar" }).click();
    await expect(d.getByTestId("resposta-rapida-bloqueada")).toBeVisible();
    expect(await mensagensDoDono(`14h ${sufixo}. Zap`)).toHaveLength(0);
    // A resposta limpa sai na conversa.
    await d.getByTestId("mensagem-campo").fill(`A entrada é a partir das 14h ${sufixo}.`);
    await d.getByRole("button", { name: "Enviar" }).click();
    await expect.poll(async () => (await mensagensDoDono(`14h ${sufixo}.`)).length, { timeout: 20_000 }).toBe(1);
    await d.context().close();
  });

  test("2–3. programadas: modelos editáveis, contato bloqueado, envio pelo cron na hora e nunca entre 22h e 7h", async ({ browser }) => {
    test.setTimeout(120_000);
    const d = await abrir(browser, dono.email);
    await d.goto(`/dashboard/estadia/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    await d.getByTestId("estadia-abrir-programadas").click();
    await expect(d.getByTestId("pagina-programadas")).toBeVisible({ timeout: 30_000 });
    const d7 = d.getByTestId("programada-7_dias_antes");
    await d7.getByTestId("programada-texto").fill(`Falta uma semana ${sufixo}! Me escreve aqui se precisar.`);
    await d7.getByTestId("programada-salvar").click();
    await expect(d7).toHaveAttribute("data-estado", "programada", { timeout: 20_000 });
    const saida = d.getByTestId("programada-saida");
    await saida.getByTestId("programada-texto").fill("Deixe a chave e me liga 34 99876-5432");
    await saida.getByTestId("programada-salvar").click();
    await expect(saida.getByTestId("programada-msg")).toContainText("Tire telefone, e-mail");
    await saida.getByTestId("programada-texto").fill(`Hoje é a sua saída ${sufixo}. Obrigado!`);
    await saida.getByTestId("programada-salvar").click();
    await expect(saida).toHaveAttribute("data-estado", "programada", { timeout: 20_000 });
    await d.getByTestId("programada-entrada").getByTestId("programada-salvar").click();
    await expect(d.getByTestId("programada-entrada")).toHaveAttribute("data-estado", "programada", { timeout: 20_000 });
    await semRolagemLateral(d);
    await d.screenshot({ path: `${SAIDA}/t347-programadas-1280.png`, fullPage: true });

    const linhas = await programadas();
    expect(linhas.map((l) => l.quando).sort()).toEqual(["7_dias_antes", "entrada", "saida"]);
    const l7 = linhas.find((l) => l.quando === "7_dias_antes")!;
    // 7 dias antes da entrada (dia 10 → dia 3), às 10h de Brasília.
    expect(new Date(l7.enviar_em).toISOString()).toBe(new Date(`${dia(3)}T13:00:00.000Z`).toISOString());
    expect(linhas.find((l) => l.quando === "saida")!.enviar_em).toContain(dia(69));

    const t = Date.parse(l7.enviar_em);
    expect(await tique(d, new Date(t - 60_000).toISOString())).toMatchObject({ enviadas: 0 });
    // Cron parado e o tique cai às 23h30 e às 3h de Brasília: nada sai.
    expect(await tique(d, new Date(t + 13.5 * 3_600_000).toISOString())).toMatchObject({ enviadas: 0, esperando: 1 });
    expect(await tique(d, new Date(t + 17 * 3_600_000).toISOString())).toMatchObject({ enviadas: 0, esperando: 1 });
    expect((await programadas()).find((l) => l.quando === "7_dias_antes")!.enviada_em).toBeNull();
    expect(await tique(d, new Date(t + 5 * 60_000).toISOString())).toMatchObject({ enviadas: 1 });
    const enviada = (await programadas()).find((l) => l.quando === "7_dias_antes")!;
    expect(enviada.enviada_em).not.toBeNull();
    expect(enviada.mensagem_id).not.toBeNull();
    expect(await mensagensDoDono(`Falta uma semana ${sufixo}`)).toHaveLength(1);
    // Segundo tique: não repete.
    expect(await tique(d, new Date(t + 10 * 60_000).toISOString())).toMatchObject({ enviadas: 0 });
    expect(await mensagensDoDono(`Falta uma semana ${sufixo}`)).toHaveLength(1);
    await d.reload({ waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("programada-7_dias_antes")).toHaveAttribute("data-estado", "enviada");
    await d.context().close();
  });

  test("4. aditivo +1 mês reagenda a mensagem da saída; a já enviada não muda", async ({ browser }) => {
    test.setTimeout(240_000);
    const antes = await programadas();
    const m = await abrir(browser, morador.email, 390);
    await m.goto(`/dashboard/estadia/${ids.contrato}/alteracao`, { waitUntil: "networkidle" });
    await m.getByTestId("alteracao-meses").selectOption("3");
    await m.getByTestId("alteracao-enviar").click();
    await expect(m).toHaveURL(new RegExp(`/dashboard/estadia/${ids.contrato}$`));
    const d = await abrir(browser, dono.email);
    await d.goto(`/dashboard/estadia/${ids.contrato}`, { waitUntil: "networkidle" });
    await d.getByTestId("aditivo-aceitar").click();
    await expect(d.getByTestId("estadia-aditivo")).toHaveAttribute("data-status", "aceito", { timeout: 30_000 });
    for (const [pagina, quem] of [[d, ids.dono!], [m, ids.morador!]] as const) {
      // Depois do aceite a página da estadia segue com requisições abertas: "networkidle" não chega em 30 s (lab-crítico
      // do #1186). Recarrega pelo DOM e espera o botão do código.
      await pagina.reload({ waitUntil: "domcontentloaded" });
      await expect(pagina.getByTestId("aditivo-pedir-codigo")).toBeVisible({ timeout: 30_000 });
      const desde = new Date().toISOString();
      await pagina.getByTestId("aditivo-pedir-codigo").click();
      await expect(pagina.getByTestId("estadia-ok").or(pagina.getByTestId("estadia-erro"))).toHaveText("Código enviado para o seu e-mail.", { timeout: 30_000 });
      await pagina.getByTestId("aditivo-codigo").fill(await codigoDaCaixa(quem, desde));
      await pagina.getByTestId("aditivo-aceite").check();
      await pagina.getByTestId("aditivo-assinar").click();
      await expect(pagina.getByTestId("estadia-ok").or(pagina.getByTestId("estadia-erro"))).toHaveText("Assinatura registrada.", { timeout: 30_000 });
    }
    const depois = await programadas();
    const s0 = antes.find((l) => l.quando === "saida")!;
    const s1 = depois.find((l) => l.quando === "saida")!;
    expect(Date.parse(s1.enviar_em), "a saída andou um mês").toBeGreaterThan(Date.parse(s0.enviar_em) + 25 * 86_400_000);
    expect(depois.find((l) => l.quando === "entrada")!.enviar_em).toBe(antes.find((l) => l.quando === "entrada")!.enviar_em);
    expect(depois.find((l) => l.quando === "7_dias_antes")!.enviada_em).toBe(antes.find((l) => l.quando === "7_dias_antes")!.enviada_em);
    await d.context().close();
    await m.context().close();
  });

  test("5. contrato encerrado cancela o que não saiu", async ({ browser }) => {
    test.setTimeout(150_000);
    const m = await abrir(browser, morador.email);
    await m.goto(`/dashboard/estadia/${ids.contrato}/encerrar`, { waitUntil: "networkidle" });
    await m.getByTestId("encerrar-motivo-mudanca_planos_morador").check();
    await m.getByTestId("encerrar-continuar").click();
    await m.getByTestId("encerrar-confirmar").click();
    await m.getByTestId("encerrar-confirmar-confirmar").click();
    await expect(m).toHaveURL(new RegExp(`/dashboard/estadia/${ids.contrato}$`));
    await m.context().close();

    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
    const a = await ctx.newPage();
    semDialogo(a);
    // Mesma causa do caso 4: o painel do admin não chega a "networkidle" em 30 s (lab-crítico do #1191). Vai pelo DOM.
    await a.goto("/admin/contratos/encerramentos", { waitUntil: "domcontentloaded" });
    const card = a.locator(`[data-testid="admin-encerramento"][data-contrato="${ids.contrato}"]`);
    await expect(card.getByTestId("encerramento-concluir")).toBeVisible({ timeout: 30_000 });
    await card.getByTestId("encerramento-concluir").click();
    await card.getByTestId("encerramento-concluir-confirmar").click();
    await expect
      .poll(async () => (await programadas()).filter((l) => !l.enviada_em).map((l) => l.motivo_cancelamento).sort(), { timeout: 30_000 })
      .toEqual(["contrato_encerrado", "contrato_encerrado"]);
    expect((await programadas()).find((l) => l.quando === "7_dias_antes")!.cancelada_em, "a enviada fica como estava").toBeNull();
    await ctx.close();

    const d = await abrir(browser, dono.email, 390);
    await d.goto(`/dashboard/estadia/${ids.contrato}/mensagens`, { waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("programadas-encerrada")).toBeVisible({ timeout: 30_000 });
    await expect(d.getByTestId("programada-saida").getByTestId("programada-historico")).toContainText("contrato encerrado");
    await semRolagemLateral(d);
    await d.screenshot({ path: `${SAIDA}/t347-programadas-encerrada-390.png`, fullPage: true });
    await d.context().close();
  });
});
