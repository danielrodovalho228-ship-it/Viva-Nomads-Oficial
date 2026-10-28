import { test, expect, type Page } from "@playwright/test";
import {
  NO_LABORATORIO,
  adm,
  apagarContas,
  criarConta,
  criarImovelPronto,
  entrar,
  lerSaida,
  novaSenha,
  novoSufixo,
} from "../fixtures/laboratorio";

/**
 * T55 — ORDEM DE MANUTENÇÃO, ciclo completo (ordens b9e73a4b e 48f96269,
 * critérios de aceite do Daniel). Contas NOVAS: dono com imóvel publicado e
 * inquilino com contrato ATIVO nele.
 *  1. Inquilino abre: seletor com os exemplos do FAQ e o prazo; a ordem aparece
 *     com "Responder até <data/hora> (horário de Brasília)".
 *  2. Proprietário vê a MESMA ordem com o prazo, inicia o atendimento e responde.
 *  3. Inquilino vê "Em atendimento", lê e responde (réplica) e marca como resolvida.
 *  4. Histórico com data/hora de cada passo; avisos por e-mail ligados por padrão;
 *     /dashboard/notificacoes abre (não é mais 404).
 *  5. F31: a Visão geral do dono com imóvel ativo não diz "ainda não publicou".
 * Larguras 360, 390 e 1280 px sem rolagem lateral.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.manut.${sufixo}@lab.vivanomads.test`, nome: "Otávio Manutenção", role: "owner" as const };
const inquilino = { email: `inq.manut.${sufixo}@lab.vivanomads.test`, nome: "Iara Manutenção", role: "tenant" as const };
const titulo = `Studio mobiliado da manutenção ${sufixo}`;
const descricao = `Vazamento embaixo da pia da cozinha (${sufixo}).`;
const ids: { dono?: string; inquilino?: string; imovel?: string; contrato?: string } = {};
const DATA_HORA = /\d{2}\/\d{2}\/\d{4},? \d{2}:\d{2}/;

async function semRolagemLateral(page: Page, largura: number) {
  await page.setViewportSize({ width: largura, height: 844 });
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra, `sem rolagem lateral a ${largura}px`).toBeLessThanOrEqual(1);
}

test.describe("T55 — Ordem de manutenção: prazo, dois lados, histórico e réplica", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inquilino = await criarConta(inquilino, senha);
    ids.imovel = await criarImovelPronto(ids.dono, titulo, { ativo: true });
    const { data, error } = await adm()
      .from("contratos")
      .insert({
        property_id: ids.imovel,
        tenant_id: ids.inquilino,
        owner_plan: "essential",
        faixa: "temporada",
        prazo_total_dias: 60,
        aluguel_mensal: 3200,
        tamanho_bloco_meses: 2,
        comissao_percent: 0.08,
        comissao_valor: 256,
        qtd_ocupantes: 1,
        status: "ativo",
        garantia: "caucao",
        // Em vigência (regra da F27, #436): as duas assinaturas + 1º aluguel confirmado. Não afrouxar a regra.
        assinado_proprietario_em: new Date().toISOString(),
        assinado_inquilino_em: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
    const hoje = new Date();
    const dia = (d: Date) => d.toISOString().slice(0, 10);
    const { data: bloco, error: eBloco } = await adm()
      .from("contrato_blocos")
      .insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: dia(hoje), fim: dia(new Date(hoje.getTime() + 60 * 86_400_000)), meses: 2, valor: 6400, caucao: 3200, status: "ativo" })
      .select("id")
      .single();
    if (eBloco) throw eBloco;
    const { error: ePag } = await adm().from("pagamentos_bloco").insert({
      bloco_id: bloco.id,
      contrato_id: ids.contrato,
      tipo: "aluguel",
      valor: 3200,
      data_pagamento: dia(hoje),
      marcado_por: ids.dono,
      confirmado_pelo_inquilino: true,
      confirmado_em: hoje.toISOString(),
    });
    if (ePag) throw ePag;
  });

  test.afterAll(async () => {
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    if (ids.inquilino) await adm().from("chamados").delete().eq("usuario_id", ids.inquilino);
    await apagarContas([ids.dono, ids.inquilino]);
  });

  test("1. inquilino abre a ordem: exemplos do FAQ, prazo e 'responder até' em Brasília", async ({ browser }) => {
    test.setTimeout(90_000);
    const page = await entrar(browser, inquilino.email, senha);
    await page.goto("/dashboard/solicitacoes", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Minhas solicitações" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /Abrir solicitação/ }).click();
    const seletor = page.getByTestId("seletor-prioridade");
    await expect(seletor).toContainText("Urgente · até 4 h");
    await expect(seletor).toContainText("Ex.: sem água, sem luz, vazamento");
    await expect(seletor).toContainText("Média · até 24 h");
    await expect(seletor).toContainText("Baixa · até 72 h");
    await seletor.getByLabel(/Urgente/).check();
    await expect(page.getByTestId("prazo-previsto")).toContainText(/até 4 h: responder até .+\(horário de Brasília\)/);
    await page.getByPlaceholder("Descreva o problema...").fill(descricao);
    await page.getByRole("button", { name: "Enviar solicitação" }).click();

    const ordem = page.getByTestId("ordem-manutencao").filter({ hasText: descricao });
    await expect(ordem).toBeVisible({ timeout: 20_000 });
    await expect(ordem.getByTestId("prazo-ordem")).toContainText(/Responder até .+ \(horário de Brasília\) · prazo de 4 h/);
    await expect(ordem.getByTestId("status-ordem")).toHaveText("Aberta");
    await semRolagemLateral(page, 360);
    await page.screenshot({ path: "tests/laboratorio/saida/t55-1-inquilino-abriu-360.png", fullPage: true });
    await page.context().close();
  });

  test("2. proprietário vê a mesma ordem com o prazo, inicia o atendimento e responde", async ({ browser }) => {
    test.setTimeout(90_000);
    const page = await entrar(browser, dono.email, senha);
    await page.goto("/dashboard/solicitacoes", { waitUntil: "networkidle" });
    const ordem = page.getByTestId("ordem-manutencao").filter({ hasText: descricao });
    await expect(ordem).toBeVisible({ timeout: 15_000 });
    await expect(ordem.getByTestId("prazo-ordem")).toContainText(/Responder até .+ \(horário de Brasília\)/);
    await ordem.getByTestId("solicitacao-cartao").click();
    await expect(ordem.getByTestId("historico-ordem")).toContainText("Inquilino abriu a ordem");
    await ordem.getByRole("button", { name: "Iniciar atendimento" }).click();
    await expect(ordem.getByTestId("status-ordem")).toHaveText("Em atendimento", { timeout: 15_000 });
    await expect(ordem.getByTestId("historico-ordem")).toContainText("Proprietário mudou para Em atendimento", { timeout: 15_000 });
    await ordem.getByLabel("Sua mensagem").fill("Vamos mandar o encanador amanhã às 9 h.");
    await ordem.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(ordem.getByTestId("mensagens-ordem")).toContainText("Vamos mandar o encanador amanhã às 9 h.");
    await expect(ordem.getByTestId("prazo-ordem")).toContainText("Respondida");
    await semRolagemLateral(page, 390);
    await semRolagemLateral(page, 1280);
    await page.screenshot({ path: "tests/laboratorio/saida/t55-2-proprietario-1280.png", fullPage: true });
    await page.context().close();
  });

  test("3. inquilino lê, responde (réplica) e marca como resolvida", async ({ browser }) => {
    test.setTimeout(90_000);
    const page = await entrar(browser, inquilino.email, senha);
    await page.goto("/dashboard/solicitacoes", { waitUntil: "networkidle" });
    const ordem = page.getByTestId("ordem-manutencao").filter({ hasText: descricao });
    await expect(ordem.getByTestId("status-ordem")).toHaveText("Em atendimento", { timeout: 15_000 });
    await ordem.getByTestId("solicitacao-cartao").click();
    await expect(ordem.getByTestId("mensagens-ordem")).toContainText("Proprietário");
    await expect(ordem.getByTestId("mensagens-ordem")).toContainText("Vamos mandar o encanador amanhã às 9 h.");
    await ordem.getByLabel("Sua mensagem").fill("Combinado, estarei em casa.");
    await ordem.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(ordem.getByTestId("mensagens-ordem")).toContainText("Combinado, estarei em casa.");
    await ordem.getByRole("button", { name: "Marcar como resolvida" }).click();
    await expect(ordem.getByTestId("status-ordem")).toHaveText("Resolvida", { timeout: 15_000 });
    const historico = ordem.getByTestId("historico-ordem");
    await expect(historico.locator("li")).toHaveCount(3, { timeout: 15_000 });
    for (const li of await historico.locator("li").all()) await expect(li).toHaveText(DATA_HORA);
    await expect(historico).toContainText("Inquilino mudou para Resolvida");
    await page.screenshot({ path: "tests/laboratorio/saida/t55-3-resolvida-390.png", fullPage: true });
    await page.context().close();

    // No banco: 3 passos no histórico e 2 mensagens (uma de cada lado).
    const { data: so } = await adm().from("service_orders").select("id, status, first_response_at, resolved_at").eq("tenant_id", ids.inquilino!).single();
    expect(so?.status).toBe("resolvido");
    expect(so?.first_response_at).toBeTruthy();
    expect(so?.resolved_at).toBeTruthy();
    const { count: nEventos } = await adm().from("service_order_eventos").select("id", { count: "exact", head: true }).eq("service_order_id", so!.id);
    expect(nEventos).toBe(3);
    const { data: msgs } = await adm().from("service_order_messages").select("sender_id").eq("service_order_id", so!.id);
    expect(new Set((msgs ?? []).map((m) => m.sender_id))).toEqual(new Set([ids.dono, ids.inquilino]));
  });

  test("4. avisos ligados por padrão (e-mail aos dois lados) e /dashboard/notificacoes abre", async ({ browser }) => {
    test.setTimeout(90_000);
    const { data: perfis } = await adm().from("profiles").select("id, notif_email, notif_whatsapp").in("id", [ids.dono!, ids.inquilino!]);
    for (const p of perfis ?? []) expect([p.notif_email, p.notif_whatsapp]).toEqual([true, true]);
    await expect
      .poll(async () => (await lerSaida()).filter((l) => l.servico === "email" && l.para === inquilino.email).length, { timeout: 30_000 })
      .toBeGreaterThan(0);
    await expect
      .poll(async () => (await lerSaida()).filter((l) => l.servico === "email" && l.para === dono.email).length, { timeout: 30_000 })
      .toBeGreaterThan(0);

    const page = await entrar(browser, dono.email, senha);
    const r = await page.goto("/dashboard/notificacoes", { waitUntil: "networkidle" });
    expect(r?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Notificações", level: 1 })).toBeVisible();
    await expect(page.getByTestId("avisos-manutencao")).toContainText("Inquilino mudou para Resolvida");
    // E176 (parte 2): Notificações é a página única — o canal "E-mail" do cartão Canais (perfil-06), ligado por padrão.
    await expect(page.getByRole("switch", { name: "E-mail" })).toBeChecked({ timeout: 15_000 });
    await semRolagemLateral(page, 360);
    await page.context().close();
  });

  test("5. F31: Visão geral do dono com imóvel ativo não diz 'ainda não publicou'", async ({ browser }) => {
    test.setTimeout(60_000);
    const page = await entrar(browser, dono.email, senha);
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await expect(page.getByText(titulo).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Você ainda não publicou imóveis")).toHaveCount(0);
    await page.goto("/dashboard/imoveis", { waitUntil: "networkidle" });
    await expect(page.getByText(titulo).first()).toBeVisible();
    await page.context().close();
  });
});
