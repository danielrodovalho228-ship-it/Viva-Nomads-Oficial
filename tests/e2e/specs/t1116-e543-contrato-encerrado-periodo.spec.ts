import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { lerDaterange } from "../../../src/lib/contrato-periodo";

/**
 * T1116 — E543 (#2508, 04/11): contrato com UM estado só. Um contrato "ativo", assinado pelas duas partes, sem
 * pagamento e com o PERÍODO já terminado (calendário de Brasília) aparecia ao mesmo tempo como "Aguardando 1º
 * pagamento" (lista e detalhe), bloco "Encerrado" e estadia "Encerrada em 30/10/2026" (VN-CT-A0268B00). A fonte única
 * (estadoDoContratoUnico) passou a ler o período: o contrato é "Encerrado em DD/MM/AAAA" em toda tela. Pela tela real,
 * 390 e 1280, com o bloco do contrato entre 90 e 35 dias atrás (o gatilho da 0176 grava contratos.periodo):
 *   1. o dono: Contratos (lista) e o detalhe do contrato dizem "Encerrado em <fim>", nunca "Aguardando 1º pagamento";
 *   2. o morador: Minhas locações (lista) e o detalhe dizem o mesmo.
 * As regras (o fim inclusivo do daterange, o calendário de Brasília) ficam com o e543-estado-contrato.test.ts.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1116.${sufixo}@lab.vivanomads.test`, nome: "Rui Periodo Lopes", role: "owner" as const };
const morador = { email: `mor.t1116.${sufixo}@lab.vivanomads.test`, nome: "Ana Periodo Lopes", role: "tenant" as const };
const ids: Record<string, string> = {};
let encerrado = "";
const dia = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

async function semAguardando(p: Page, rota: string) {
  await p.goto(rota, { waitUntil: "domcontentloaded" });
  const main = p.locator("main");
  await expect(main).toContainText(encerrado, { timeout: 30_000 });
  await expect(main).not.toContainText("Aguardando 1º pagamento");
}

test.describe("T1116 — E543: contrato com o período terminado é \"Encerrado em DD/MM/AAAA\" em toda tela", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Casa do período E543 ${sufixo}`, { ativo: true });
    ids.lead = await criarLead(ids.dono, ids.morador, ids.imovel, true);
    const assinado = new Date(Date.now() - 95 * 86_400_000).toISOString();
    const { data, error } = await adm()
      .from("contratos")
      .insert({
        property_id: ids.imovel,
        tenant_id: ids.morador,
        lead_id: ids.lead,
        owner_plan: "essential",
        faixa: "temporada",
        prazo_total_dias: 56,
        aluguel_mensal: 3200,
        tamanho_bloco_meses: 2,
        comissao_percent: 0.08,
        comissao_valor: 512,
        qtd_ocupantes: 1,
        status: "ativo",
        garantia: "caucao",
        assinado_proprietario_em: assinado,
        assinado_inquilino_em: assinado,
      })
      .select("id")
      .single();
    expect(error, error?.message).toBeNull();
    ids.contrato = data!.id as string;
    // O bloco no passado (sem nenhum pagamento): o gatilho da 0176 grava contratos.periodo a partir dele.
    const { error: eBloco } = await adm()
      .from("contrato_blocos")
      .insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: dia(-90), fim: dia(-35), meses: 2, valor: 6400, caucao: 3200, status: "ativo" });
    expect(eBloco, eBloco?.message).toBeNull();
    const { data: c } = await adm().from("contratos").select("periodo").eq("id", ids.contrato).single();
    const p = lerDaterange(c?.periodo);
    expect(p, `contratos.periodo gravado pelo gatilho (${String(c?.periodo)})`).not.toBeNull();
    const [a, m, d] = p!.fim.split("-");
    encerrado = `Encerrado em ${d}/${m}/${a}`;
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono, ids.morador]);
  });

  for (const w of [390, 1280] as const) {
    test(`dono e morador: lista e detalhe dizem "Encerrado em <fim>" (${w})`, async ({ browser }) => {
      const pd = await entrar(browser, dono.email, senha);
      await pd.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      try {
        await semAguardando(pd, "/dashboard/contratos");
        await semAguardando(pd, `/dashboard/contratos/${ids.contrato}`);
      } finally {
        await pd.context().close();
      }
      const pm = await entrar(browser, morador.email, senha);
      await pm.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      try {
        await semAguardando(pm, "/dashboard/locacoes");
        await semAguardando(pm, `/dashboard/locacoes/${ids.contrato}`);
        const sobra = await pm.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(sobra).toBeLessThanOrEqual(1);
      } finally {
        await pm.context().close();
      }
    });
  }
});
