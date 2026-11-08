import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1454 — E680 (#3239 e #3311, na main): a lista de locações só aparece para a conta para a qual foi montada. Depois de uma
  troca de conta no mesmo navegador (a conta A deixa o guardado "vivanomads-auth" e a sessão acaba; a conta B entra), a
  tela /dashboard/locacoes da B mostra SÓ a locação da B — nunca a da A —, a 390 e 1280 px, sem estouro horizontal.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1454.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona", role: "owner" as const };
const contaA = { email: `a.t1454.${sufixo}@lab.vivanomads.test`, nome: "Ana Anterior", role: "tenant" as const };
const contaB = { email: `b.t1454.${sufixo}@lab.vivanomads.test`, nome: "Bia Seguinte", role: "tenant" as const };
const ids: { dono?: string; a?: string; b?: string; imA?: string; imB?: string; ctA?: string; ctB?: string; ldA?: string; ldB?: string } = {};
const TIT_A = `Studio Anterior T1454 ${sufixo}`;
const TIT_B = `Studio Seguinte T1454 ${sufixo}`;
const dia = (n: number) => new Date(Date.now() - 3 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);

async function contrato(imovel: string, inq: string, lead: string) {
  const agora = new Date().toISOString();
  const { data, error } = await adm()
    .from("contratos")
    .insert({ lead_id: lead, property_id: imovel, tenant_id: inq, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3000, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 240, qtd_ocupantes: 1, status: "ativo", garantia: "caucao", assinado_proprietario_em: agora, assinado_inquilino_em: agora })
    .select("id")
    .single();
  if (error) throw error;
  const { error: eb } = await adm().from("contrato_blocos").insert({ contrato_id: data.id, numero_bloco: 1, inicio: dia(10), fim: dia(69), meses: 2, valor: 6000, caucao: 3000, status: "ativo" });
  if (eb) throw eb;
  return data.id as string;
}

test.describe("T1454 — E680: lista de locações só da conta que está logada", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.a = await criarConta(contaA, senha);
    ids.b = await criarConta(contaB, senha);
    ids.imA = await criarImovelPronto(ids.dono, TIT_A, { ativo: true, preco: 3000 });
    ids.imB = await criarImovelPronto(ids.dono, TIT_B, { ativo: true, preco: 3000 });
    ids.ldA = await criarLead(ids.dono, ids.a, ids.imA, true);
    ids.ldB = await criarLead(ids.dono, ids.b, ids.imB, true);
    ids.ctA = await contrato(ids.imA, ids.a, ids.ldA);
    ids.ctB = await contrato(ids.imB, ids.b, ids.ldB);
  });
  test.afterAll(async () => {
    for (const c of [ids.ctA, ids.ctB]) if (c) await adm().from("contratos").delete().eq("id", c);
    for (const l of [ids.ldA, ids.ldB]) if (l) await adm().from("leads").delete().eq("id", l);
    await apagarContas([ids.dono, ids.a, ids.b]);
  });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: depois da troca de conta, só a locação da conta que entrou`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390 });
      const p = await ctx.newPage();
      await entrarNaPagina(p, contaA.email, senha);
      await p.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
      await expect(p.getByText(TIT_A).first()).toBeVisible({ timeout: 40_000 });
      // A sessão da A acaba; o guardado do navegador (com a A) fica. A B entra no MESMO navegador.
      await ctx.clearCookies();
      await entrarNaPagina(p, contaB.email, senha);
      await p.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
      await expect(p.getByText(TIT_B).first()).toBeVisible({ timeout: 40_000 });
      await expect(p.getByText(TIT_A), "a locação da conta anterior não aparece").toHaveCount(0);
      expect(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await ctx.close();
    });
  }
});
