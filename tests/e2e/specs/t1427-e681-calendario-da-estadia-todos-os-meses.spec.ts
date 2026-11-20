import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1427 — E681 (#3245): o calendário da estadia mostra TODOS os meses da entrada à saída, não só os dois das pontas (o mês
  do meio sumia: fevereiro). Estadia de ~90 dias, que atravessa de 3 a 4 meses: a quantidade de cartões de mês e os meses
  (data-mes) são exatamente os do intervalo, sem repetir nem faltar. Morador, 390 e 1280 px, sem estouro horizontal.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1427.${sufixo}@lab.vivanomads.test`, nome: "Dora Calendário", role: "owner" as const };
const morador = { email: `mor.t1427.${sufixo}@lab.vivanomads.test`, nome: "Moacir Calendário", role: "tenant" as const };
const ids: { dono?: string; morador?: string; imovel?: string; lead?: string; contrato?: string } = {};
const dia = (n: number) => new Date(Date.now() - 3 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);
const INICIO = dia(10);
const FIM = dia(99);

/** Meses (aaaa-mm) de INICIO a FIM, um a um. */
function mesesEsperados(): string[] {
  const out: string[] = [];
  let [a, m] = INICIO.slice(0, 7).split("-").map(Number);
  const [fa, fm] = FIM.slice(0, 7).split("-").map(Number);
  while (a < fa || (a === fa && m <= fm)) {
    out.push(`${a}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) { m = 1; a += 1; }
  }
  return out;
}

test.describe("T1427 — E681: calendário da estadia com todos os meses", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio T1427 ${sufixo}`, { ativo: true, preco: 3000 });
    ids.lead = await criarLead(ids.dono, ids.morador, ids.imovel, true);
    const agora = new Date().toISOString();
    const { data: c, error } = await adm()
      .from("contratos")
      .insert({ lead_id: ids.lead, property_id: ids.imovel, tenant_id: ids.morador, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: 90, aluguel_mensal: 3000, tamanho_bloco_meses: 3, comissao_percent: 0.1, comissao_valor: 900, qtd_ocupantes: 1, capacidade_snapshot: 3, assinado_proprietario_em: agora, assinado_inquilino_em: agora })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = c.id as string;
    const { error: eb } = await adm().from("contrato_blocos").insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: INICIO, fim: FIM, meses: 3, valor: 9000, caucao: 3000, status: "ativo" });
    if (eb) throw eb;
  });
  test.afterAll(async () => {
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    if (ids.lead) await adm().from("leads").delete().eq("id", ids.lead);
    await apagarContas([ids.dono, ids.morador]);
  });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: um cartão de mês para cada mês da estadia, sem faltar o do meio`, async ({ browser }) => {
      const p = await entrar(browser, morador.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await p.goto(`/dashboard/estadia/${ids.contrato}`, { waitUntil: "domcontentloaded" });
      const painel = p.getByTestId("estadia-calendario");
      await expect(painel).toBeVisible({ timeout: 30_000 });
      const esperados = mesesEsperados();
      expect(esperados.length).toBeGreaterThanOrEqual(3);
      const meses = await painel.getByTestId("calendario-mes").evaluateAll((els) => els.map((e) => e.getAttribute("data-mes")));
      expect(meses, "meses do calendário = meses da estadia").toEqual(esperados);
      expect(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await p.context().close();
    });
  }
});
