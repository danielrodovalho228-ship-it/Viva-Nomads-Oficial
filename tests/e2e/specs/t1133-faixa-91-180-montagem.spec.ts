import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1133 — TRAVA FAIXA_91_180 (#2547, 05/11): estadias de 91 a 180 dias atrás da chave NEXT_PUBLIC_FAIXA_91_180_ATIVA,
 * LIGADA por padrão (só "off" desliga). Ligada, nada muda: a montagem da proposta aceita até 180 dias; desligada,
 * estadias NOVAS ficam em 30–90 (um bloco de temporada). Entrou com o faixa-91-180.test.ts; aqui é a tela do dono, 390 e
 * 1280, com a chave como estiver no ambiente, no anúncio do caso fixo da t216 (R$ 3.200/mês, sem condomínio, consumo,
 * limpezas nem desconto) e uma candidatura de 150 dias:
 *   ligada (padrão) → "Estadia de 30 a 180 dias", "Estadia: 150 dias", total R$ 16.000 (3.200 × 150 ÷ 30);
 *   desligada        → "Estadia de 30 a 90 dias", "Estadia: 90 dias", total R$ 9.600 (a candidatura cabe no teto).
 * Nada é enviado.
 */
const LIGADA = process.env.NEXT_PUBLIC_FAIXA_91_180_ATIVA !== "off";
const TETO = LIGADA ? 180 : 90;
const DIAS = LIGADA ? 150 : 90;
const TOTAL = LIGADA ? "16\\.000" : "9\\.600";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1133.${sufixo}@lab.vivanomads.test`, nome: "Gil Faixa Souza", role: "owner" as const };
const mor = { email: `mor.t1133.${sufixo}@lab.vivanomads.test`, nome: "Rosa Faixa Souza", role: "tenant" as const };
const ids: Record<string, string> = {};
const emDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

test.describe(`T1133 — FAIXA_91_180 (${LIGADA ? "ligada" : "desligada"}): a montagem respeita o teto de ${TETO} dias`, () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.mor = await criarConta(mor, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Casa da faixa 91-180 ${sufixo}`, { ativo: true, preco: 3200 });
    const { error } = await adm()
      .from("properties")
      .update({ negociacao: { aceita: true, itens: ["valor_mensal", "meses", "data_entrada", "limpeza"], descontos: [] }, min_period_days: 30, max_period_days: 180, condo_fee: 0, utilities_mode: "real", prep_fee: 0, checkout_cleaning_enabled: false, limpeza_estadia: null })
      .eq("id", ids.imovel);
    expect(error, error?.message).toBeNull();
    ids.lead = await criarLead(ids.dono, ids.mor, ids.imovel);
    const { error: e } = await adm().from("leads").update({ inicio_desejado: emDias(10), fim_desejado: emDias(160) }).eq("id", ids.lead);
    expect(e, e?.message).toBeNull();
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono, ids.mor]);
  });

  for (const w of [390, 1280] as const) {
    test(`candidatura de 150 dias → ${DIAS} dias e o total proporcional; ajuda "30 a ${TETO} dias" (${w})`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      try {
        await p.goto(`/dashboard/orcamentos/nova?interessado=${ids.lead}`, { waitUntil: "domcontentloaded" });
        await expect(p.getByTestId("montagem-proposta")).toBeVisible({ timeout: 30_000 });
        await expect(p.getByTestId("montagem-proposta")).toContainText(`Estadia de 30 a ${TETO} dias, como no anúncio.`);
        await expect(p.getByTestId("proposta-dias")).toContainText(`Estadia: ${DIAS} dias`);
        await expect(p.getByTestId("resumo-rotulo-total")).toHaveText(`Total da estadia (${DIAS} dias)`);
        await expect(p.getByTestId("resumo-total-contrato")).toHaveText(new RegExp(`^R\\$\\s${TOTAL}(,00)?$`));
        expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await p.context().close();
      }
    });
  }
});
