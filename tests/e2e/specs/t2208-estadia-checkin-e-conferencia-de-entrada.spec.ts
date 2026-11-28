import { test, expect, type Browser, type Page } from "@playwright/test";
import { prazoConferenciaEntrada, textoPrazoConferencia } from "../../../src/lib/conferencia";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2208 — Estadia e saída, 2.ª perna: o check-in e a conferência de entrada (ORDEM-DUET-317). Só no laboratório.
  Sobre um contrato assinado, com a entrada daqui a 3 dias (dentro do D-7):
    1. instruções de chegada: o dono preenche pela tela; sem o 1.º pagamento confirmado, o morador vê as instruções
       bloqueadas; com ele, vê-as; o item "Instruções de chegada" do dono fica feito;
    2. a conferência de entrada: o prazo na tela é o da FONTE ÚNICA (prazoConferenciaEntrada: o dia da entrada no
       horário de entrada do imóvel, + 48 h), nas duas pontas; o dono regista um cômodo; o morador regista o dele e
       confirma o registo do dono → "Aguardando a outra parte"; o dono confirma o do morador → "Confirmada";
    3. os estados dos dois lados na página da estadia: o item "Conferência de entrada" acompanha (por fazer até as duas
       partes confirmarem; depois, "Confirmada pelas duas partes" com o prazo).
  O 1.º pagamento é gravado pelo laboratório (simulação declarada): a perna dos pagamentos tem a sua trava pela tela (t2206).
  Os achados desta perna estão no PR, para decisão do Gerente; o spec só prende o que o código já decide.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2208.${sufixo}@lab.vivanomads.test`, nome: "Dalva Chegada", role: "owner" as const };
const morador = { email: `mor.t2208.${sufixo}@lab.vivanomads.test`, nome: "Moema Chegada", role: "tenant" as const };
const ids: { dono?: string; morador?: string; imovel?: string; lead?: string; contrato?: string; bloco1?: string } = {};
const TITULO = `Studio da chegada ${sufixo}`;
const SALA = `Sala ${sufixo}`;
const QUARTO = `Quarto ${sufixo}`;
/** Datas em Brasília (a mesma conta do t256). */
const dia = (n: number) => new Date(Date.now() - 3 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);
const ENTRADA = dia(3);

async function abrir(browser: Browser, email: string, largura = 1280): Promise<Page> {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  return page;
}

async function estadia(page: Page) {
  await page.goto(`/dashboard/estadia/${ids.contrato}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await expect(page.getByTestId("estadia-checklist")).toBeVisible({ timeout: 30_000 });
}

async function adicionarItem(page: Page, comodo: string, descricao: string) {
  const form = page.getByTestId("conferencia-entrada-form");
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await form.getByLabel("Cômodo", { exact: true }).fill(comodo);
  await form.getByLabel("Itens e estado do cômodo").fill(descricao);
  await form.getByRole("button", { name: "Adicionar item" }).click();
  await expect(page.getByTestId("conferencia-erro")).toHaveCount(0);
  await expect(page.getByTestId("conferencia-entrada-itens")).toContainText(comodo, { timeout: 20_000 });
}

/** O prazo esperado pela fonte única, com o horário de entrada que o imóvel tem no banco. */
async function prazoEsperado(): Promise<Date> {
  const { data } = await adm().from("properties").select("checkin_after").eq("id", ids.imovel!).single();
  const p = prazoConferenciaEntrada({ inicio: ENTRADA, checkinAfter: (data?.checkin_after as string | null) ?? null });
  expect(p, "o contrato tem prazo de conferência").not.toBeNull();
  return p!;
}

test.describe("T2208 — Estadia: o check-in e a conferência de entrada, com o prazo, nos dois lados @estadia", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.imovel = await criarImovelPronto(ids.dono, TITULO, { ativo: true, preco: 3000 });
    ids.lead = await criarLead(ids.dono, ids.morador, ids.imovel, true);
    const agora = new Date().toISOString();
    // Simulação declarada: o contrato nasce assinado pelas duas partes (a assinatura tem prova própria, t2157 etapa 8).
    const { data: c, error } = await adm()
      .from("contratos")
      .insert({
        lead_id: ids.lead, property_id: ids.imovel, tenant_id: ids.morador, owner_plan: "essential", faixa: "media_estadia",
        prazo_total_dias: 60, aluguel_mensal: 3000, tamanho_bloco_meses: 2, comissao_percent: 0.1, comissao_valor: 600,
        qtd_ocupantes: 1, capacidade_snapshot: 2, status: "ativo", garantia: "caucao",
        assinado_proprietario_em: agora, assinado_inquilino_em: agora,
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = c.id as string;
    const { data: b1, error: e1 } = await adm()
      .from("contrato_blocos")
      .insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: ENTRADA, fim: dia(62), meses: 2, valor: 6000, caucao: 1500, status: "ativo" })
      .select("id")
      .single();
    if (e1) throw e1;
    ids.bloco1 = b1.id as string;
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

  test("1. instruções de chegada: o dono preenche; bloqueadas sem o 1º pagamento; liberadas com ele (D-3)", async ({ browser }) => {
    test.info().annotations.push({ type: "simulação", description: "contrato assinado e 1º pagamento confirmado gravados pelo laboratório (a perna dos pagamentos é a t2206)" });
    const d = await abrir(browser, dono.email);
    await d.goto(`/dashboard/estadia/${ids.contrato}#instrucoes`, { waitUntil: "domcontentloaded" });
    await d.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await d.getByTestId("instrucoes-como_entrar").fill(`Portaria 24 h ${sufixo}: diga o seu nome na entrada.`);
    await d.getByTestId("instrucoes-salvar").click();
    await expect(d.getByTestId("estadia-ok")).toBeVisible();
    await estadia(d);
    await expect(d.getByTestId("checklist-instrucoes"), "dono: instruções publicadas").toHaveAttribute("data-feito", "sim");
    await d.context().close();

    const m = await abrir(browser, morador.email, 390);
    await estadia(m);
    await expect(m.getByTestId("instrucoes-bloqueadas"), "sem o 1º pagamento, bloqueadas").toContainText(/1º pagamento/);
    await expect(m.getByText(`Portaria 24 h ${sufixo}`)).toHaveCount(0);
    await adm().from("pagamentos_bloco").insert({ bloco_id: ids.bloco1, contrato_id: ids.contrato, tipo: "aluguel", valor: 3000, data_pagamento: dia(0), marcado_por: ids.dono, confirmado_pelo_inquilino: true, confirmado_em: new Date().toISOString() });
    await estadia(m);
    await expect(m.getByTestId("instrucoes-liberadas"), "com o 1º pagamento e no D-7, liberadas").toContainText(`Portaria 24 h ${sufixo}`);
    await expect(m.getByTestId("checklist-primeiro_pagamento")).toHaveAttribute("data-feito", "sim");
    await m.context().close();
  });

  test("2. a conferência de entrada: o prazo da fonte única nas duas pontas; dono regista, morador regista e confirma, dono confirma", async ({ browser }) => {
    const prazo = await prazoEsperado();
    const texto = textoPrazoConferencia(prazo);

    const d = await abrir(browser, dono.email, 390);
    await d.goto(`/dashboard/contratos/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("conferencia-entrada")).toBeVisible({ timeout: 20_000 });
    await expect(d.getByTestId("conferencia-prazo"), "dono: o prazo da fonte única").toHaveAttribute("data-prazo", prazo.toISOString());
    await expect(d.getByTestId("conferencia-prazo")).toContainText(texto);
    await expect(d.getByTestId("conferencia-entrada-estado")).toHaveText("Em andamento");
    await adicionarItem(d, SALA, "Sofá sem manchas, TV na parede.");
    await d.context().close();

    const m = await abrir(browser, morador.email, 390);
    await m.goto(`/dashboard/locacoes/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    await expect(m.getByTestId("conferencia-entrada")).toContainText(SALA, { timeout: 20_000 });
    await expect(m.getByTestId("conferencia-prazo"), "morador: o mesmo prazo").toHaveAttribute("data-prazo", prazo.toISOString());
    await adicionarItem(m, QUARTO, "Cama de casal, um arranhão na cabeceira.");
    await m.getByTestId("conferencia-entrada-confirmar").click();
    await expect(m.getByTestId("conferencia-entrada-estado")).toHaveText("Aguardando a outra parte", { timeout: 20_000 });
    await m.context().close();

    // Na página da estadia, com uma parte só: o item continua por fazer, nos dois lados.
    for (const quem of [dono, morador]) {
      const p = await abrir(browser, quem.email);
      await estadia(p);
      await expect(p.getByTestId("checklist-conferencia"), `${quem.nome}: por fazer com uma parte só`).toHaveAttribute("data-feito", "nao");
      await expect(p.getByTestId("checklist-conferencia")).toContainText("Aguardando a outra parte");
      await expect(p.getByTestId("checklist-conferencia")).toContainText(texto);
      await p.context().close();
    }

    const d2 = await abrir(browser, dono.email);
    await d2.goto(`/dashboard/contratos/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    await expect(d2.getByTestId("conferencia-entrada")).toContainText(QUARTO, { timeout: 20_000 });
    await d2.getByTestId("conferencia-entrada-confirmar").click();
    await expect(d2.getByTestId("conferencia-entrada-estado")).toContainText("Confirmada", { timeout: 20_000 });
    await d2.context().close();
  });

  test("3. confirmada pelas duas partes: o item 'Conferência de entrada' fica feito nos dois lados (390 e 1280)", async ({ browser }) => {
    const texto = textoPrazoConferencia(await prazoEsperado());
    for (const largura of [390, 1280] as const) {
      for (const quem of [morador, dono]) {
        const p = await abrir(browser, quem.email, largura);
        await estadia(p);
        await expect(p.getByTestId("checklist-conferencia"), `${quem.nome} ${largura}: feita`).toHaveAttribute("data-feito", "sim");
        await expect(p.getByTestId("checklist-conferencia")).toContainText("Confirmada pelas duas partes");
        await expect(p.getByTestId("checklist-conferencia")).toContainText(texto);
        expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), "sem rolagem lateral").toBeLessThanOrEqual(1);
        await p.context().close();
      }
    }
  });
});
