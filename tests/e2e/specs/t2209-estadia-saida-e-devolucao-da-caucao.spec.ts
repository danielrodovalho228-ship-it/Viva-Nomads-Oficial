import { test, expect, type Browser, type Page } from "@playwright/test";
import { prazoConferenciaSaida, textoPrazoConferencia } from "../../../src/lib/conferencia";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2209 — Estadia e saída, 3.ª perna: a saída e a devolução da caução (ORDEM-DUET-320). Só no laboratório.
  Sobre um contrato assinado, pago e com a caução recebida e confirmada, cuja estadia terminou ontem:
    1. o fim da estadia: ao abrir Contratos, o app encerra o contrato; a página da estadia diz "Encerrada em…" aos dois;
    2. a conferência de SAÍDA, cômodo a cômodo (até hoje só o laudo da saída tinha trava, t85): o prazo é o da fonte
       única (prazoConferenciaSaida: o último dia no horário de saída do imóvel, + 48 h), nas duas pontas; o dono regista
       um cômodo; o morador regista o dele e confirma → "Aguardando a outra parte"; o dono confirma → confirmada;
    3. a devolução com desconto (caução retida em parte): o dono regista pela tela; os dois lados veem "aguardando a
       confirmação do morador"; o morador confirma → os dois lados veem "devolução com descontos confirmada pelo morador",
       e o acerto fica `desconto_confirmado`, com o valor devolvido.
  O caminho da devolução integral e o da contestação têm trava na t2157 (etapa 9); aqui fica o desconto confirmado.
  Simulação declarada: o contrato, os pagamentos e o fim da estadia (as datas do bloco no passado) gravados pelo laboratório.
  Achado no PR: o desconto NÃO grava motivo (não há campo; a tela só pede para explicar pela conversa).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2209.${sufixo}@lab.vivanomads.test`, nome: "Dalva Saida", role: "owner" as const };
const morador = { email: `mor.t2209.${sufixo}@lab.vivanomads.test`, nome: "Moema Saida", role: "tenant" as const };
const ids: { dono?: string; morador?: string; imovel?: string; lead?: string; contrato?: string; bloco1?: string } = {};
const TITULO = `Studio da saida ${sufixo}`;
const SALA = `Sala ${sufixo}`;
const COZINHA = `Cozinha ${sufixo}`;
const CAUCAO = 1500;
const DEVOLVIDO = 1200;
/** Datas em Brasília (a mesma conta do t256). */
const dia = (n: number) => new Date(Date.now() - 3 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);
const FIM = dia(-1);
// formatBRL da tela: sem centavos quando o valor é inteiro ("R$ 1.200").
const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR")}`;

async function abrir(browser: Browser, email: string, largura = 1280): Promise<Page> {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  return page;
}

async function adicionarItem(page: Page, comodo: string, descricao: string) {
  const form = page.getByTestId("conferencia-saida-form");
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await form.getByLabel("Cômodo", { exact: true }).fill(comodo);
  await form.getByLabel("Itens e estado do cômodo").fill(descricao);
  await form.getByRole("button", { name: "Adicionar item" }).click();
  await expect(page.getByTestId("conferencia-erro")).toHaveCount(0);
  await expect(page.getByTestId("conferencia-saida-itens")).toContainText(comodo, { timeout: 20_000 });
}

async function prazoEsperado(): Promise<Date> {
  const { data } = await adm().from("properties").select("checkout_before").eq("id", ids.imovel!).single();
  const p = prazoConferenciaSaida({ fim: FIM, checkoutBefore: (data?.checkout_before as string | null) ?? null });
  expect(p, "o contrato tem prazo de conferência de saída").not.toBeNull();
  return p!;
}

async function ultimoAcerto() {
  return (await adm().from("caucao_acertos").select("status, tipo, valor_devolvido").eq("contrato_id", ids.contrato!).order("created_at", { ascending: false }).limit(1).maybeSingle()).data;
}

test.describe("T2209 — Estadia: a saída, a conferência de saída e a devolução da caução com desconto, nos dois lados @estadia", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.imovel = await criarImovelPronto(ids.dono, TITULO, { ativo: true, preco: 3000 });
    ids.lead = await criarLead(ids.dono, ids.morador, ids.imovel, true);
    const agora = new Date().toISOString();
    const { data: c, error } = await adm()
      .from("contratos")
      .insert({
        lead_id: ids.lead, property_id: ids.imovel, tenant_id: ids.morador, owner_plan: "essential", faixa: "media_estadia",
        prazo_total_dias: 36, aluguel_mensal: 3000, tamanho_bloco_meses: 1, comissao_percent: 0.1, comissao_valor: 300,
        qtd_ocupantes: 1, capacidade_snapshot: 2, status: "ativo", garantia: "caucao",
        assinado_proprietario_em: agora, assinado_inquilino_em: agora,
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = c.id as string;
    const { data: b1, error: e1 } = await adm()
      .from("contrato_blocos")
      .insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: dia(-36), fim: FIM, meses: 1, valor: 3000, caucao: CAUCAO, status: "ativo" })
      .select("id")
      .single();
    if (e1) throw e1;
    ids.bloco1 = b1.id as string;
    // O 1º pagamento e a caução, registados pelo dono e confirmados pelo morador (a perna dos pagamentos é a t2206).
    for (const [tipo, valor] of [["aluguel", 3000], ["caucao", CAUCAO]] as const) {
      // A regra do banco (0182): o aluguel tem o bloco; a caução é do contrato, sem bloco.
      const { error: ep } = await adm().from("pagamentos_bloco").insert({ bloco_id: tipo === "aluguel" ? ids.bloco1 : null, contrato_id: ids.contrato, tipo, valor, data_pagamento: dia(-36), marcado_por: ids.dono, confirmado_pelo_inquilino: true, confirmado_em: agora });
      if (ep) throw ep;
    }
  });
  test.afterAll(async () => {
    if (ids.contrato) {
      const { data: confs } = await adm().from("conferencias").select("id").eq("contrato_id", ids.contrato);
      const confIds = (confs ?? []).map((x) => x.id as string);
      if (confIds.length) {
        for (const t of ["conferencia_laudos", "conferencia_respostas", "conferencia_itens"]) await adm().from(t).delete().in("conferencia_id", confIds);
        await adm().from("conferencias").delete().in("id", confIds);
      }
    }
    await apagarContas([ids.dono!, ids.morador!].filter(Boolean));
  });

  test("1. o fim da estadia: o app encerra o contrato e a página da estadia diz 'Encerrada' aos dois", async ({ browser }) => {
    test.info().annotations.push({ type: "simulação", description: "contrato, pagamentos e fim da estadia (datas do bloco no passado) gravados pelo laboratório" });
    const d = await abrir(browser, dono.email);
    await d.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    await expect
      .poll(async () => (await adm().from("contratos").select("status").eq("id", ids.contrato!).single()).data?.status, { timeout: 20_000, message: "o app encerra o contrato no fim da estadia" })
      .toBe("encerrado_sem_renovacao");
    await d.context().close();
    for (const quem of [dono, morador]) {
      const p = await abrir(browser, quem.email, 390);
      await p.goto(`/dashboard/estadia/${ids.contrato}`, { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("estadia-topo-texto"), `${quem.nome}: a estadia encerrada`).toContainText("Encerrada", { timeout: 30_000 });
      await expect(p.getByTestId("estadia-checklist"), `${quem.nome}: sem o "Antes da entrada"`).toHaveCount(0);
      await p.context().close();
    }
  });

  test("2. a conferência de saída: o prazo da fonte única nas duas pontas; dono regista, morador regista e confirma, dono confirma", async ({ browser }) => {
    const prazo = await prazoEsperado();
    const texto = textoPrazoConferencia(prazo);

    const d = await abrir(browser, dono.email, 390);
    await d.goto(`/dashboard/contratos/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("conferencia-saida")).toBeVisible({ timeout: 20_000 });
    await expect(d.getByTestId("conferencia-prazo-saida"), "dono: o prazo da fonte única").toHaveAttribute("data-prazo", prazo.toISOString());
    await expect(d.getByTestId("conferencia-prazo-saida")).toContainText(texto);
    await adicionarItem(d, SALA, "Sofá com uma mancha no braço direito.");
    await d.context().close();

    const m = await abrir(browser, morador.email, 390);
    await m.goto(`/dashboard/locacoes/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    await expect(m.getByTestId("conferencia-saida")).toContainText(SALA, { timeout: 20_000 });
    await expect(m.getByTestId("conferencia-prazo-saida"), "morador: o mesmo prazo").toHaveAttribute("data-prazo", prazo.toISOString());
    await adicionarItem(m, COZINHA, "Geladeira limpa e desligada.");
    await m.getByTestId("conferencia-saida-confirmar").click();
    await expect(m.getByTestId("conferencia-saida-estado")).toHaveText("Aguardando a outra parte", { timeout: 20_000 });
    await m.context().close();

    const d2 = await abrir(browser, dono.email);
    await d2.goto(`/dashboard/contratos/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    await expect(d2.getByTestId("conferencia-saida")).toContainText(COZINHA, { timeout: 20_000 });
    await expect(d2.getByTestId("conferencia-saida-estado")).toHaveText("Aguardando a outra parte");
    await d2.getByTestId("conferencia-saida-confirmar").click();
    await expect(d2.getByTestId("conferencia-saida-estado")).toContainText("Confirmada", { timeout: 20_000 });
    await d2.context().close();

    const m2 = await abrir(browser, morador.email);
    await m2.goto(`/dashboard/locacoes/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    await expect(m2.getByTestId("conferencia-saida-estado"), "morador: confirmada pelos dois").toContainText("Confirmada", { timeout: 20_000 });
    await m2.context().close();
  });

  test("3. a devolução com desconto: o dono regista, os dois veem a espera; o morador confirma e os dois veem o desconto confirmado", async ({ browser }) => {
    const d = await abrir(browser, dono.email);
    await d.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    await d.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await d.getByTestId("devolucao-caucao").first().getByRole("button", { name: "Registrar devolução da caução" }).click();
    const form = d.getByTestId("devolucao-caucao").first();
    await form.locator("input").first().fill(String(DEVOLVIDO));
    await expect(form.getByText(/Com desconto, explique os motivos/), "a tela avisa do desconto").toBeVisible();
    await form.getByRole("button", { name: "Registrar devolução", exact: true }).click();
    await expect.poll(ultimoAcerto, { timeout: 20_000, message: "a devolução com desconto grava" }).toEqual({ status: "aguardando_confirmacao", tipo: "desconto", valor_devolvido: DEVOLVIDO });
    await d.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("devolucao-caucao").first(), "dono: à espera do morador").toContainText("aguardando a confirmação do morador", { timeout: 20_000 });
    await expect(d.getByTestId("devolucao-caucao").first()).toContainText(brl(DEVOLVIDO));
    await d.context().close();

    const m = await abrir(browser, morador.email);
    await m.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
    await m.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    const pedido = m.getByTestId("devolucao-caucao").first();
    await expect(pedido, "morador: o valor devolvido e a caução").toContainText(brl(DEVOLVIDO), { timeout: 20_000 });
    await expect(pedido).toContainText(brl(CAUCAO));
    await pedido.getByRole("button", { name: /Sim, recebi/ }).click();
    await expect.poll(async () => (await ultimoAcerto())?.status, { timeout: 20_000, message: "a confirmação do desconto grava" }).toBe("desconto_confirmado");
    await m.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
    await expect(m.getByTestId("devolucao-caucao").first(), "morador: desconto confirmado").toContainText("devolução com descontos confirmada pelo morador", { timeout: 20_000 });
    await m.context().close();

    const d2 = await abrir(browser, dono.email, 390);
    await d2.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    await expect(d2.getByTestId("devolucao-caucao").first(), "dono: desconto confirmado").toContainText("devolução com descontos confirmada pelo morador", { timeout: 20_000 });
    expect(await d2.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), "sem rolagem lateral").toBeLessThanOrEqual(1);
    await d2.context().close();
  });
});
