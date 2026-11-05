import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1120 — E562 (#2512, 04/11, E-DIAS): a estadia é em DIAS exatos (30 a 180) e o preço é proporcional — Total =
 * Total por mês × dias ÷ 30. A montagem da proposta abre com os dias da candidatura (entrada → saída), sem arredondar
 * para meses. Entrou com testes de unidade (estadia-em-dias, e562-servidor) e a 0291; aqui é a tela real do dono, 390 e
 * 1280, no anúncio do caso fixo da t216 (R$ 3.200/mês, sem condomínio, consumo, limpezas nem desconto por estadia):
 *   1. candidatura de 45 dias → "Total do contrato" R$ 4.800 (3.200 × 45 ÷ 30) — antes do E562, 45 dias viravam
 *      2 meses (R$ 6.400);
 *   2. candidatura de 60 dias → R$ 6.400 (meses cheios: o mesmo de antes);
 *   3. o "Total por mês" é R$ 3.200 nas duas.
 * Nada é enviado (só a montagem). As regras ficam com os testes de unidade.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1120.${sufixo}@lab.vivanomads.test`, nome: "Iara Dias Moura", role: "owner" as const };
const morA = { email: `mora.t1120.${sufixo}@lab.vivanomads.test`, nome: "Caio Dias Moura", role: "tenant" as const };
const morB = { email: `morb.t1120.${sufixo}@lab.vivanomads.test`, nome: "Rita Dias Moura", role: "tenant" as const };
const ids: Record<string, string> = {};
const emDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const limpo = (t: string) => t.replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();

test.describe("T1120 — E562: a proposta abre com os dias da candidatura e o total proporcional", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.a = await criarConta(morA, senha);
    ids.b = await criarConta(morB, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio em dias E562 ${sufixo}`, { ativo: true, preco: 3200 });
    const { error } = await adm()
      .from("properties")
      .update({ negociacao: { aceita: true, itens: ["valor_mensal", "meses", "data_entrada", "limpeza"], descontos: [] }, min_period_days: 30, max_period_days: 180, condo_fee: 0, utilities_mode: "real", prep_fee: 0, checkout_cleaning_enabled: false, limpeza_estadia: null })
      .eq("id", ids.imovel);
    expect(error, error?.message).toBeNull();
    const entrada = emDias(10);
    ids.lead45 = await criarLead(ids.dono, ids.a, ids.imovel);
    ids.lead60 = await criarLead(ids.dono, ids.b, ids.imovel);
    for (const [lead, dias] of [[ids.lead45, 45], [ids.lead60, 60]] as const) {
      const { error: e } = await adm().from("leads").update({ inicio_desejado: entrada, fim_desejado: emDias(10 + dias) }).eq("id", lead);
      expect(e, e?.message).toBeNull();
    }
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono, ids.a, ids.b]);
  });

  for (const w of [390, 1280] as const) {
    test(`45 dias → R$ 4.800 (proporcional); 60 dias → R$ 6.400; total por mês R$ 3.200 (${w})`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      try {
        for (const [lead, total] of [[ids.lead45, "4\\.800"], [ids.lead60, "6\\.400"]] as const) {
          await p.goto(`/dashboard/orcamentos/nova?interessado=${lead}`, { waitUntil: "domcontentloaded" });
          await expect(p.getByTestId("montagem-proposta")).toBeVisible({ timeout: 30_000 });
          await expect(p.getByTestId("resumo-total-mensal")).toHaveText(/^R\$\s3\.200(,00)?$/);
          const contrato = p.getByTestId("resumo-total-contrato");
          await expect(contrato).toHaveText(new RegExp(`^R\\$\\s${total}(,00)?$`));
          test.info().annotations.push({ type: "total", description: `${lead === ids.lead45 ? 45 : 60} dias: ${limpo(await contrato.innerText())}` });
        }
        expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await p.context().close();
      }
    });
  }
});
