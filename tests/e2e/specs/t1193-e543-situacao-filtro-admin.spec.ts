import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1193 — E543, 2ª parte (#2727, 05/11): na lista de contratos do admin, o filtro "Situação" lia o status cru do banco
 * ("ativo") e trazia em "Ativo" um contrato que a própria linha dizia "Encerrado em 30/10". Agora o filtro e as opções
 * saem da mesma fonte do selo (situacaoParaEquipe ← estadoDoContratoUnico). O E543 entrou só com teste de unidade; aqui
 * é a tela, a 390 e 1280, com um contrato do laboratório "ativo" no banco cujo bloco terminou há 10 dias:
 *   1. sem filtro, a linha dele tem o selo "Encerrado…";
 *   2. com Situação = Em vigência, ele não aparece;
 *   3. com Situação = Encerrado, ele aparece.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1193.${sufixo}@lab.vivanomads.test`, nome: "Rui Situação", role: "owner" as const };
const inq = { email: `inq.t1193.${sufixo}@lab.vivanomads.test`, nome: "Sara Situação", role: "tenant" as const };
const ids: { dono?: string; inq?: string; contrato?: string } = {};
const dia = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

test.describe("T1193 — E543: o filtro Situação do admin segue o selo do contrato", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
  test.use({ storageState: authFile("admin") });
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    const imovel = await criarImovelPronto(ids.dono, `Contrato encerrado t1193 ${sufixo}`, { ativo: true, preco: 3000 });
    const assinado = new Date(Date.now() - 75 * 86_400_000).toISOString();
    const { data, error } = await adm()
      .from("contratos")
      .insert({
        property_id: imovel, tenant_id: ids.inq, owner_plan: "free", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3000,
        tamanho_bloco_meses: 2, comissao_percent: 0.1, comissao_valor: 600, qtd_ocupantes: 1, status: "ativo", garantia: "caucao",
        assinado_proprietario_em: assinado, assinado_inquilino_em: assinado,
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
    const { error: eB } = await adm().from("contrato_blocos").insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: dia(-70), fim: dia(-10), meses: 2, valor: 6000, caucao: 3000, status: "ativo" });
    if (eB) throw eB;
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    await apagarContas([ids.inq, ids.dono]);
  });

  for (const w of [1280, 390] as const) {
    test(`ativo no banco, encerrado na linha: o filtro segue o selo (${w})`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      const linha = () => page.getByTestId("contrato-linha").filter({ has: page.locator(`a[href="/admin/contratos/${ids.contrato}"]`) });

      await page.goto("/admin/contratos?tipo=todos", { waitUntil: "domcontentloaded" });
      await expect(linha()).toHaveCount(1, { timeout: 30_000 });
      await expect(linha().getByTestId("contrato-selo")).toContainText(/Encerrado/);

      await page.goto("/admin/contratos?tipo=todos&status=em_vigencia", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("admin-contratos")).toBeVisible({ timeout: 30_000 });
      await expect(linha(), "encerrado não entra em Em vigência").toHaveCount(0);

      await page.goto("/admin/contratos?tipo=todos&status=encerrado", { waitUntil: "domcontentloaded" });
      await expect(linha(), "entra em Encerrado").toHaveCount(1, { timeout: 30_000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    });
  }
});
