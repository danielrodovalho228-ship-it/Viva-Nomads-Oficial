import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1195 — E562 (#2729, 05/11, parte de tela): no Fechamento com proposta ACEITA, prazo, blocos, base e taxa ficam nos
 * DIAS da proposta — a tela mostrava "2 meses" para uma proposta de 43 dias. O E562 entrou só com teste de unidade; aqui
 * é a tela, a 390 e 1280, com uma proposta aceita de 43 dias a R$ 3.000/mês semeada no banco:
 *   1. no 1º passo, o prazo aparece como "43 dias (…)" (fechamento-prazo-dias, que só existe com o prazo em dias —
 *      sem o E562 a tela mostrava o seletor de meses com "2 meses");
 *   2. nenhuma cobrança real (a página só é aberta, nada é gerado).
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1195.${sufixo}@lab.vivanomads.test`, nome: "Vera Dias", role: "owner" as const };
const inq = { email: `inq.t1195.${sufixo}@lab.vivanomads.test`, nome: "Davi Dias", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; lead?: string; proposta?: string } = {};
const emDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

test.describe("T1195 — E562: o Fechamento com proposta aceita fica nos dias da proposta", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio em dias t1195 ${sufixo}`, { ativo: true, preco: 3000 });
    ids.lead = await criarLead(ids.dono, ids.inq, ids.imovel, true);
    await adm().from("leads").update({ accepted_at: new Date().toISOString() }).eq("id", ids.lead);
    const { data: numero } = await adm().rpc("next_document_number", { p_type: "orcamento", p_year: new Date().getFullYear() });
    const { data: p, error } = await adm()
      .from("propostas")
      .insert({ numero, lead_id: ids.lead, property_id: ids.imovel, owner_id: ids.dono, tenant_id: ids.inq, status: "aceita", aceita_em: new Date().toISOString(), versao_atual: 1, validade_dias: 7, valida_ate: emDias(7) + "T23:00:00Z" })
      .select("id")
      .single();
    if (error) throw error;
    ids.proposta = p.id as string;
    const { error: eV } = await adm()
      .from("proposta_versoes")
      .insert({ proposta_id: ids.proposta, versao: 1, autor: "owner", valor_base: 3000, valor_mensal: 3000, meses: 2, dias: 43, data_entrada: emDias(20), total_mensal: 3000, total_contrato: 4300 });
    if (eV) throw eV;
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    if (ids.proposta) await adm().from("propostas").delete().eq("id", ids.proposta);
    if (ids.lead) await adm().from("cobrancas_fechamento").delete().eq("lead_id", ids.lead);
    await apagarContas([ids.inq, ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`43 dias na tela, não "2 meses" (${w})`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await page.goto(`/dashboard/fechamento?c=${ids.lead}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("fechamento-prazo-dias").first()).toContainText(/^43 dias \(/, { timeout: 30_000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await page.context().close();
    });
  }

  test("nenhuma cobrança gerada só por abrir o Fechamento", async () => {
    const { data } = await adm().from("cobrancas_fechamento").select("id").eq("lead_id", ids.lead!);
    expect(data ?? []).toHaveLength(0);
  });
});
