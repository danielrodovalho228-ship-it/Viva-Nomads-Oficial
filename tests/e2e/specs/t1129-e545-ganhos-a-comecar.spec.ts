import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo, tornarContratoVigente } from "../fixtures/laboratorio";

/**
 * T1129 — E545 (#2544, 05/11): em Contratos → Ganhos, "Contratado a começar" soma TODOS os contratos a começar — inclusive
 * o de um anúncio PAUSADO depois de alugar. Antes, as linhas vinham da carteira de anúncios ATIVOS e esse contrato ficava
 * de fora ("Contratado a começar" R$ 0 com vários "Aguardando 1º pagamento"). Entrou com testes de unidade
 * (ganhos-dono.test.ts); aqui é a tela do dono, 390 e 1280:
 *   A. anúncio ativo, contrato em vigência (R$ 3.200, 1º pagamento confirmado) → "Em vigência" vale 3.200;
 *   B. anúncio PAUSADO, contrato assinado que começa em 20 dias, sem pagamento (R$ 2.700) → "Contratado a começar" vale
 *      2.700 (antes do E545, 0);
 *   e a lista traz uma linha por contrato (2).
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1129.${sufixo}@lab.vivanomads.test`, nome: "Vera Ganhos Lima", role: "owner" as const };
const morA = { email: `mora.t1129.${sufixo}@lab.vivanomads.test`, nome: "Davi Ganhos Lima", role: "tenant" as const };
const morB = { email: `morb.t1129.${sufixo}@lab.vivanomads.test`, nome: "Lia Ganhos Lima", role: "tenant" as const };
const ids: Record<string, string> = {};
const dia = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

async function contrato(imovel: string, morador: string, lead: string, aluguel: number): Promise<string> {
  const { data, error } = await adm()
    .from("contratos")
    .insert({
      property_id: imovel,
      tenant_id: morador,
      lead_id: lead,
      owner_plan: "essential",
      faixa: "temporada",
      prazo_total_dias: 60,
      aluguel_mensal: aluguel,
      tamanho_bloco_meses: 2,
      comissao_percent: 0.08,
      comissao_valor: Math.round(aluguel * 2 * 0.08),
      qtd_ocupantes: 1,
      status: "ativo",
      garantia: "caucao",
    })
    .select("id")
    .single();
  expect(error, error?.message).toBeNull();
  return data!.id as string;
}

test.describe("T1129 — E545: \"Contratado a começar\" soma o contrato do anúncio pausado", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.a = await criarConta(morA, senha);
    ids.b = await criarConta(morB, senha);
    ids.imA = await criarImovelPronto(ids.dono, `Casa em vigência E545 ${sufixo}`, { ativo: true, preco: 3200 });
    ids.imB = await criarImovelPronto(ids.dono, `Loft pausado E545 ${sufixo}`, { ativo: true, preco: 2700 });
    // A: em vigência (assinado + 1º pagamento confirmado, bloco de hoje).
    ids.cA = await contrato(ids.imA, ids.a, await criarLead(ids.dono, ids.a, ids.imA, true), 3200);
    await tornarContratoVigente(ids.cA, ids.dono, 3200);
    // B: assinado, começa em 20 dias, sem pagamento — e o anúncio pausado depois de alugar.
    ids.cB = await contrato(ids.imB, ids.b, await criarLead(ids.dono, ids.b, ids.imB, true), 2700);
    const assinado = new Date().toISOString();
    const { error: eAss } = await adm().from("contratos").update({ assinado_proprietario_em: assinado, assinado_inquilino_em: assinado }).eq("id", ids.cB);
    expect(eAss, eAss?.message).toBeNull();
    const { error: eBloco } = await adm()
      .from("contrato_blocos")
      .insert({ contrato_id: ids.cB, numero_bloco: 1, inicio: dia(20), fim: dia(79), meses: 2, valor: 5400, caucao: 2700, status: "agendado" });
    expect(eBloco, eBloco?.message).toBeNull();
    const { error: ePausa } = await adm().from("properties").update({ status: "paused" }).eq("id", ids.imB);
    expect(ePausa, ePausa?.message).toBeNull();
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono, ids.a, ids.b]);
  });

  for (const w of [390, 1280] as const) {
    test(`Ganhos: em vigência 3.200; a começar 2.700 (anúncio pausado); uma linha por contrato (${w})`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      try {
        await p.goto("/dashboard/ganhos", { waitUntil: "domcontentloaded" });
        await expect(p.getByTestId("ganhos")).toBeVisible({ timeout: 30_000 });
        await expect(p.getByTestId("ganhos-vigencia")).toHaveAttribute("data-valor", "3200", { timeout: 20_000 });
        await expect(p.getByTestId("ganhos-a-comecar"), "o contrato do anúncio pausado entra no \"a começar\"").toHaveAttribute("data-valor", "2700");
        await expect(p.getByTestId("ganhos-linha")).toHaveCount(2);
        await expect(p.getByTestId("ganhos-lista")).toContainText(`Loft pausado E545 ${sufixo}`);
        expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await p.context().close();
      }
    });
  }
});
