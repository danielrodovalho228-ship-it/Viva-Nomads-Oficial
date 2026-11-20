import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1398 — E672 (#3162): a tela "Propor alteração" mostra a saída e os dias exatos do que está sendo proposto (meses × 30
  dias), tem o campo "Motivo (opcional)", e a proposta grava o comparativo antes × depois (dias, saída, total, diferença) e
  o motivo no aditivo; o resumo da proposta diz a saída nova. Morador, 390 px (e 1280 px na leitura), sem estouro.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1398.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona", role: "owner" as const };
const morador = { email: `mor.t1398.${sufixo}@lab.vivanomads.test`, nome: "Ivo Morador", role: "tenant" as const };
const ids: { dono?: string; morador?: string; imovel?: string; lead?: string; contrato?: string } = {};
const dia = (n: number) => new Date(Date.now() - 3 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);
const MOTIVO = "Preciso de mais um mês por causa da obra";

test.describe("T1398 — E672: comparativo e motivo na proposta de alteração", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio T1398 ${sufixo}`, { ativo: true, preco: 3000 });
    ids.lead = await criarLead(ids.dono, ids.morador, ids.imovel, true);
    const agora = new Date().toISOString();
    const { data: c, error } = await adm()
      .from("contratos")
      .insert({ lead_id: ids.lead, property_id: ids.imovel, tenant_id: ids.morador, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: 90, aluguel_mensal: 3000, tamanho_bloco_meses: 2, comissao_percent: 0.1, comissao_valor: 900, qtd_ocupantes: 2, capacidade_snapshot: 3, assinado_proprietario_em: agora, assinado_inquilino_em: agora })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = c.id as string;
    const { error: e1 } = await adm().from("contrato_blocos").insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: dia(8), fim: dia(67), meses: 2, valor: 6000, caucao: 3000, status: "ativo" });
    if (e1) throw e1;
    const { error: e2 } = await adm().from("contrato_blocos").insert({ contrato_id: ids.contrato, numero_bloco: 2, inicio: dia(68), fim: dia(97), meses: 1, valor: 3000, caucao: 0, status: "agendado", aceite_proprietario_em: agora, aceite_inquilino_em: agora });
    if (e2) throw e2;
  });
  test.afterAll(async () => {
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    if (ids.lead) await adm().from("leads").delete().eq("id", ids.lead);
    await apagarContas([ids.dono, ids.morador]);
  });

  test("saída e dias exatos acompanham os meses; a proposta grava comparativo e motivo", async ({ browser }) => {
    const m = await entrar(browser, morador.email, senha);
    await m.setViewportSize({ width: 1280, height: 900 });
    await m.goto(`/dashboard/estadia/${ids.contrato}/alteracao`, { waitUntil: "domcontentloaded" });
    const saida = m.getByTestId("alteracao-saida");
    await expect(saida).toBeVisible({ timeout: 30_000 });
    await m.getByTestId("alteracao-meses").selectOption("4");
    await expect(saida).toHaveAttribute("data-dias", "120");
    const saida4 = await saida.getAttribute("data-saida");
    await m.getByTestId("alteracao-meses").selectOption("5");
    await expect(saida).toHaveAttribute("data-dias", "150");
    expect(await saida.getAttribute("data-saida"), "a saída anda com os meses").not.toBe(saida4);
    await expect(saida).toContainText("dias");

    await m.setViewportSize({ width: 390, height: 844 });
    await m.getByTestId("alteracao-meses").selectOption("4");
    await expect(m.getByTestId("alteracao-motivo")).toBeVisible();
    expect(await m.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await m.getByTestId("alteracao-motivo").fill(MOTIVO);
    await m.getByTestId("alteracao-enviar").click();
    await expect(m).toHaveURL(new RegExp(`/dashboard/estadia/${ids.contrato}$`), { timeout: 30_000 });
    await expect(m.getByTestId("aditivo-resumo")).toContainText("Meses: de 3 para 4");
    await expect(m.getByTestId("aditivo-resumo")).toContainText("Saída: de");

    const { data } = await adm().from("contrato_aditivos").select("mudancas").eq("contrato_id", ids.contrato!).eq("status", "proposto").single();
    const mud = data!.mudancas as { motivo?: string; comparativo?: { antes: { dias: number; total: number }; depois: { dias: number; total: number }; diferenca: number } };
    expect(mud.motivo).toBe(MOTIVO);
    expect(mud.comparativo, "comparativo gravado").toBeTruthy();
    expect(mud.comparativo!.depois.dias).toBeGreaterThan(mud.comparativo!.antes.dias);
    expect(mud.comparativo!.diferenca).toBeCloseTo(mud.comparativo!.depois.total - mud.comparativo!.antes.total, 2);
    expect(mud.comparativo!.diferenca).toBeGreaterThan(0);
    expect(await m.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await m.context().close();
  });
});
