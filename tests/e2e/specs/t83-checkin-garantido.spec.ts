import { test, expect, type Page } from "@playwright/test";
import {
  NO_LABORATORIO,
  adm,
  apagarContas,
  criarConta,
  criarImovelPronto,
  entrar,
  novaSenha,
  novoSufixo,
} from "../fixtures/laboratorio";

/**
 * T83 — CHECK-IN GARANTIDO (ordem 404cd213, item 2). Contas NOVAS: dono com imóvel publicado e inquilino com
 * contrato em vigência (duas assinaturas + 1º aluguel confirmado).
 *  1. Inquilino, sem instruções do dono: vê "ainda não enviou" e o botão "Não consegui entrar".
 *  2. Dono preenche horário, como entrar e telefone de plantão (com validação: telefone sem DDD é recusado).
 *  3. Inquilino lê as instruções e o telefone de plantão.
 *  4. Inquilino aperta "Não consegui entrar": nasce ordem de manutenção URGENTE (prazo de 4 h) para o dono
 *     e um chamado P1 para a equipe; o dono vê a ordem em /dashboard/solicitacoes.
 *  5. O dono NÃO vê o botão "Não consegui entrar".
 * 360, 390 e 1280 px sem rolagem lateral.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.checkin.${sufixo}@lab.vivanomads.test`, nome: "Otávio Check-in", role: "owner" as const };
const inquilino = { email: `inq.checkin.${sufixo}@lab.vivanomads.test`, nome: "Iara Check-in", role: "tenant" as const };
const titulo = `Studio mobiliado do check-in ${sufixo}`;
const ids: { dono?: string; inquilino?: string; imovel?: string; contrato?: string } = {};

async function semRolagemLateral(page: Page, largura: number) {
  await page.setViewportSize({ width: largura, height: 844 });
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra, `sem rolagem lateral a ${largura}px`).toBeLessThanOrEqual(1);
}

test.describe("T83 — Check-in garantido: instruções de entrada e 'Não consegui entrar'", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inquilino = await criarConta(inquilino, senha);
    ids.imovel = await criarImovelPronto(ids.dono, titulo, { ativo: true });
    const agora = new Date().toISOString();
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
        assinado_proprietario_em: agora,
        assinado_inquilino_em: agora,
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

  test("1. inquilino sem instruções do dono: aviso e botão 'Não consegui entrar'", async ({ browser }) => {
    test.setTimeout(90_000);
    const page = await entrar(browser, inquilino.email, senha);
    await page.goto(`/dashboard/locacoes/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("checkin-painel")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("checkin-pendente")).toContainText("ainda não enviou as instruções de entrada");
    await expect(page.getByTestId("checkin-nao-consegui-botao")).toBeVisible();
    await expect(page.getByTestId("checkin-form")).toHaveCount(0);
    for (const l of [360, 390, 1280]) await semRolagemLateral(page, l);
    await page.context().close();
  });

  test("2. dono preenche as instruções (telefone sem DDD é recusado)", async ({ browser }) => {
    test.setTimeout(90_000);
    const page = await entrar(browser, dono.email, senha);
    await page.goto(`/dashboard/contratos/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("checkin-form")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("checkin-nao-consegui-botao")).toHaveCount(0);
    await page.getByTestId("checkin-horario").fill("14:00");
    await page.getByTestId("checkin-instrucoes").fill("Retire a chave no cofre da portaria; a senha chega pelas mensagens.");
    await page.getByTestId("checkin-plantao").fill("99999-0000");
    await page.getByTestId("checkin-salvar").click();
    await expect(page.getByTestId("checkin-erro")).toContainText("telefone de plantão com DDD");
    await page.getByTestId("checkin-plantao").fill("(34) 99999-0000");
    await page.getByTestId("checkin-salvar").click();
    await expect(page.getByTestId("checkin-aviso")).toContainText("Instruções salvas");
    for (const l of [360, 390, 1280]) await semRolagemLateral(page, l);
    await page.screenshot({ path: "tests/laboratorio/saida/t83-2-dono-360.png", fullPage: true });
    await page.context().close();
  });

  test("3. inquilino lê horário, instruções e plantão", async ({ browser }) => {
    test.setTimeout(90_000);
    const page = await entrar(browser, inquilino.email, senha);
    await page.goto(`/dashboard/locacoes/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    const lidas = page.getByTestId("checkin-instrucoes-lidas");
    await expect(lidas).toBeVisible({ timeout: 20_000 });
    await expect(lidas).toContainText("Entrada às 14:00");
    await expect(lidas).toContainText("cofre da portaria");
    await expect(lidas).toContainText("(34) 99999-0000");
    await page.context().close();
  });

  test("4. 'Não consegui entrar' abre ordem URGENTE (4 h) e o dono vê", async ({ browser }) => {
    test.setTimeout(120_000);
    const inq = await entrar(browser, inquilino.email, senha);
    await inq.goto(`/dashboard/locacoes/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    await inq.getByTestId("checkin-nao-consegui-botao").click();
    await expect(inq.getByTestId("checkin-aviso")).toContainText(/Abrimos um pedido URGENTE \(VN-\d+\)/, { timeout: 30_000 });
    await expect(inq.getByTestId("checkin-aviso")).toContainText("4 horas");
    await inq.context().close();

    const { data: ordens } = await adm().from("service_orders").select("priority, status, owner_id").eq("tenant_id", ids.inquilino!).eq("contrato_id", ids.contrato!);
    expect(ordens?.length).toBe(1);
    expect(ordens?.[0].priority).toBe("urgente");
    expect(ordens?.[0].owner_id).toBe(ids.dono);
    const { data: chamados } = await adm().from("chamados").select("categoria, prioridade, service_order_id").eq("usuario_id", ids.inquilino!);
    expect(chamados?.some((c) => c.categoria === "acesso_imovel" && c.prioridade === "p1" && !!c.service_order_id)).toBe(true);

    const d = await entrar(browser, dono.email, senha);
    await d.goto("/dashboard/solicitacoes", { waitUntil: "networkidle" });
    const ordem = d.getByTestId("ordem-manutencao").filter({ hasText: /Não consegui entrar/ });
    await expect(ordem).toBeVisible({ timeout: 20_000 });
    await expect(ordem.getByTestId("prazo-ordem")).toContainText("prazo de 4 h");
    await d.context().close();
  });
});
