import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1415 — E661 (guia em blocos, estrutura do condomínio) + E662 (instrução ÚNICA de saída), sobre o #3164:
    1. Guia da estadia do morador (instruções liberadas: D-3, contrato assinado, 1º pagamento): blocos "O imóvel e o que está
       incluso" e "Estrutura do condomínio" (com a nota "Informado pelo proprietário, pode variar."), e "Como sair (check-out)"
       com UM texto, o mesmo que o dono escreveu.
    2. Dono, página da estadia: "Lembretes (opcional)" (não bloqueiam nada).
    3. Dono, editar o imóvel: seção "Como sair (check-out)" grava a instrução única (confere no banco).
  390 e 1280 px, sem estouro horizontal.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1415.${sufixo}@lab.vivanomads.test`, nome: "Dalva Guia", role: "owner" as const };
const morador = { email: `mor.t1415.${sufixo}@lab.vivanomads.test`, nome: "Moacir Guia", role: "tenant" as const };
const ids: { dono?: string; morador?: string; imovel?: string; lead?: string; contrato?: string; bloco?: string } = {};
const dia = (n: number) => new Date(Date.now() - 3 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);
const SAIDA = "Saída até 11 h; deixe a chave na portaria com o porteiro Zé.";

test.describe("T1415 — E661/E662: guia em blocos e instrução única de saída", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio T1415 ${sufixo}`, { ativo: true, preco: 3000 });
    ids.lead = await criarLead(ids.dono, ids.morador, ids.imovel, true);
    const agora = new Date().toISOString();
    const { data: c, error } = await adm()
      .from("contratos")
      .insert({ lead_id: ids.lead, property_id: ids.imovel, tenant_id: ids.morador, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: 60, aluguel_mensal: 3000, tamanho_bloco_meses: 2, comissao_percent: 0.1, comissao_valor: 600, qtd_ocupantes: 1, capacidade_snapshot: 3, assinado_proprietario_em: agora, assinado_inquilino_em: agora })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = c.id as string;
    const { data: b, error: e1 } = await adm().from("contrato_blocos").insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: dia(3), fim: dia(62), meses: 2, valor: 6000, caucao: 3000, status: "ativo" }).select("id").single();
    if (e1) throw e1;
    ids.bloco = b.id as string;
    const { error: ep } = await adm().from("pagamentos_bloco").insert({ bloco_id: ids.bloco, contrato_id: ids.contrato, tipo: "aluguel", valor: 3000, data_pagamento: dia(0), marcado_por: ids.dono, confirmado_pelo_inquilino: true, confirmado_em: agora });
    if (ep) throw ep;
    const { error: ei } = await adm().from("imovel_instrucoes_chegada").upsert({
      property_id: ids.imovel, como_entrar: "Portaria 24 h: diga o seu nome.", wifi_rede: "StudioLab", wifi_senha: "senha-do-lab", vaga: "Vaga 12",
      regras_condominio: "Silêncio depois das 22 h.", condominio_wifi_rede: "CondoNet", condominio_recepcao: "Recepção no térreo, 7 h às 22 h.", instrucao_saida: SAIDA,
    }, { onConflict: "property_id" });
    if (ei) throw ei;
  });
  test.afterAll(async () => {
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    if (ids.lead) await adm().from("leads").delete().eq("id", ids.lead);
    await apagarContas([ids.dono, ids.morador]);
  });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: morador lê o guia em blocos e UMA instrução de saída`, async ({ browser }) => {
      const p = await entrar(browser, morador.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await p.goto(`/dashboard/estadia/${ids.contrato}`, { waitUntil: "domcontentloaded" });
      const guia = p.getByTestId("instrucoes-liberadas");
      await expect(guia).toBeVisible({ timeout: 30_000 });
      await expect(guia.getByTestId("instrucoes-grupo-imovel")).toContainText("O imóvel e o que está incluso");
      await expect(guia.getByTestId("instrucoes-grupo-imovel")).toContainText("StudioLab");
      const condo = guia.getByTestId("instrucoes-grupo-condominio");
      await expect(condo).toContainText("Estrutura do condomínio");
      await expect(condo).toContainText("CondoNet");
      await expect(condo.getByTestId("instrucoes-condominio-nota")).toHaveText("Informado pelo proprietário, pode variar.");
      const saida = guia.getByTestId("instrucoes-grupo-saida");
      await expect(saida).toContainText("Como sair (check-out)");
      await expect(saida.getByTestId("instrucao-saida-texto")).toHaveText(SAIDA);
      await expect(guia.getByTestId("instrucao-saida-texto")).toHaveCount(1);
      expect(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await p.context().close();
    });
  }

  test("dono: página da estadia mostra os lembretes opcionais", async ({ browser }) => {
    const d = await entrar(browser, dono.email, senha);
    await d.setViewportSize({ width: 390, height: 844 });
    await d.goto(`/dashboard/estadia/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    const lembretes = d.getByTestId("estadia-lembretes");
    await expect(lembretes).toBeVisible({ timeout: 30_000 });
    await expect(lembretes).toContainText("Lembretes (opcional)");
    expect(await d.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await d.context().close();
  });

  test("dono: editar o imóvel grava a instrução única de saída", async ({ browser }) => {
    const d = await entrar(browser, dono.email, senha);
    await d.setViewportSize({ width: 1280, height: 900 });
    await d.goto(`/dashboard/imoveis/${ids.imovel}/editar`, { waitUntil: "domcontentloaded" });
    const secao = d.getByTestId("secao-instrucao-saida");
    await expect(secao).toBeVisible({ timeout: 30_000 });
    if ((await secao.getAttribute("data-aberta")) !== "true") await secao.getByRole("button").first().click();
    const nova = "Saída até 10 h. Devolva a chave ao zelador.";
    await secao.getByTestId("instrucao-saida-campo").fill(nova);
    await secao.getByRole("button", { name: /salvar/i }).first().click();
    await expect.poll(async () => (await adm().from("imovel_instrucoes_chegada").select("instrucao_saida").eq("property_id", ids.imovel!).single()).data?.instrucao_saida, { timeout: 30_000 }).toBe(nova);
    expect(await d.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await d.context().close();
  });
});
