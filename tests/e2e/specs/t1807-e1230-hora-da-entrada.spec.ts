import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo, tornarContratoVigente } from "../fixtures/laboratorio";

/*
  Vizinha do E1240 (ESPEC-E1240 v5, secção 5.4): o campo "Horário de saída (opcional)" e a âncora da saída. Corre sem alteração.

  T1807 — E1230 @E1230 (ORDENS-DUET 1207, 1300 e 1303). A trava de tela com MASSA PRÓPRIA: a hora da entrada vem das
  INSTRUÇÕES do contrato (contratos_checkin.horario = 14:00) e o anúncio fica SEM hora (checkin_after / checkout_before
  vazios) — a massa das specs antigas escondia o defeito porque semeava a hora no anúncio.
   1. Antes da segunda assinatura (só o morador assinou): o MORADOR vê "horário a combinar" na "Sua estadia" do
      contrato; o DONO vê "a partir das 14:00".
   2. Depois das duas assinaturas: o morador e o dono veem "a partir das 14:00" na "Sua estadia" (página da estadia e do
      contrato) e na linha "Entrada"; a saída aparece "horário a combinar com o proprietário" ("Saída em {data}, …").
  O "Entra hoje" do dono lê a mesma hora por contrato (t610 e t612). Laboratório; não é prova ao vivo no site.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.1807.${sufixo}@lab.vivanomads.test`, nome: "Rita Instruções", role: "owner" as const };
const inq = { email: `inq.1807.${sufixo}@lab.vivanomads.test`, nome: "Caio Chegada", role: "tenant" as const };
const ids: { dono?: string; inq?: string; casa?: string; contrato?: string } = {};
const A_COMBINAR_SAIDA = "horário a combinar com o proprietário";

test.describe("T1807 — a hora da entrada vem das instruções do contrato; o morador só a vê depois das duas assinaturas @E1230", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.casa = await criarImovelPronto(ids.dono, `Casa das instruções ${sufixo}`, { ativo: true });
    // O anúncio SEM hora: a única hora do contrato é a das instruções.
    { const { error } = await adm().from("properties").update({ checkin_after: null, checkout_before: null }).eq("id", ids.casa); if (error) throw error; }
    const lead = await criarLead(ids.dono, ids.inq, ids.casa, true);
    const { data, error } = await adm()
      .from("contratos")
      .insert({ property_id: ids.casa, tenant_id: ids.inq, lead_id: lead, owner_plan: "pro", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 512, qtd_ocupantes: 1, status: "ativo", garantia: "caucao" })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
    await tornarContratoVigente(ids.contrato, ids.dono, 3200);
    { const { error: eK } = await adm().from("contratos_checkin").upsert({ contrato_id: ids.contrato, horario: "14:00" }, { onConflict: "contrato_id" }); if (eK) throw eK; }
    // Fase 1: só o morador assinou.
    { const { error: eA } = await adm().from("contratos").update({ assinado_proprietario_em: null }).eq("id", ids.contrato); if (eA) throw eA; }
  });

  test.afterAll(async () => {
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    await apagarContas([ids.dono, ids.inq]);
  });

  test("1. antes da segunda assinatura: o morador vê 'horário a combinar'; o dono vê 14:00", async ({ browser }) => {
    const m = await entrar(browser, inq.email, senha);
    await m.goto(`/dashboard/contratos/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    const entradaM = m.getByTestId("estadia-etapa-entrada");
    await expect(entradaM).toContainText("horário a combinar", { timeout: 30_000 });
    await expect(entradaM).not.toContainText("14:00");
    await expect(m.getByTestId("estadia-etapa-saida")).toContainText(A_COMBINAR_SAIDA);
    await m.context().close();

    const d = await entrar(browser, dono.email, senha);
    await d.goto(`/dashboard/contratos/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("estadia-etapa-entrada")).toContainText("a partir das 14:00, horário de Brasília", { timeout: 30_000 });
    await expect(d.getByTestId("estadia-etapa-saida")).toContainText(A_COMBINAR_SAIDA);
    await d.context().close();
  });

  test("2. depois das duas assinaturas: morador e dono veem 14:00 (estadia e contrato); a saída a combinar com o proprietário", async ({ browser }) => {
    { const { error } = await adm().from("contratos").update({ assinado_proprietario_em: new Date().toISOString() }).eq("id", ids.contrato!); if (error) throw error; }
    for (const quem of [inq, dono]) {
      const p = await entrar(browser, quem.email, senha);
      await p.goto(`/dashboard/estadia/${ids.contrato}`, { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("estadia-etapa-entrada")).toContainText("a partir das 14:00, horário de Brasília", { timeout: 30_000 });
      await expect(p.getByTestId("estadia-entrada")).toContainText(/^Entrada: \d{2}\/\d{2}\/\d{4} a partir das 14:00$/);
      await expect(p.getByTestId("estadia-saida")).toContainText(/^Saída em \d{2}\/\d{2}\/\d{4}, horário a combinar com o proprietário$/);
      await expect(p.getByTestId("estadia-etapa-saida")).toContainText(A_COMBINAR_SAIDA);
      await p.goto(`/dashboard/contratos/${ids.contrato}`, { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("estadia-etapa-entrada")).toContainText("a partir das 14:00, horário de Brasília", { timeout: 30_000 });
      await p.context().close();
    }
  });
});
