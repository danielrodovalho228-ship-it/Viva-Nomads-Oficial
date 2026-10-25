import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T461 — PROP-5: área Contratos sem repetição. Só no laboratório (contas e contrato novos).
   1. Caução (390 e 1280): uma linha por bloco com valor, forma, status e devolução; cada linha com "Ver contrato";
      nenhum cartão de contrato repetido.
   2. /dashboard/contratos#conferencia abre o contrato com a conferência de entrada pendente, na seção da conferência;
      a etapa "Conferência de entrada" da linha do tempo leva à mesma seção.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.prop5.${sufixo}@lab.vivanomads.test`, nome: "Célia Contratos", role: "owner" as const };
const inquilino = { email: `inq.prop5.${sufixo}@lab.vivanomads.test`, nome: "Davi Morador", role: "tenant" as const };
const ids: { dono?: string; inquilino?: string; contrato?: string } = {};
const SAIDA = "tests/laboratorio/saida";
const dia = (d: Date) => d.toISOString().slice(0, 10);

test.describe("T461 — PROP-5: Contratos sem repetição", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (contas e contrato novos).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inquilino = await criarConta(inquilino, senha);
    const imovel = await criarImovelPronto(ids.dono, `Studio PROP-5 ${sufixo}`, { ativo: true });
    const agora = new Date().toISOString();
    const { data, error } = await adm()
      .from("contratos")
      .insert({
        property_id: imovel, tenant_id: ids.inquilino, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 120,
        aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 512, qtd_ocupantes: 1,
        status: "ativo", garantia: "caucao", assinado_proprietario_em: agora, assinado_inquilino_em: agora,
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
    const hoje = new Date();
    const em = (dias: number) => dia(new Date(hoje.getTime() + dias * 86_400_000));
    const { error: eb } = await adm().from("contrato_blocos").insert([
      { contrato_id: ids.contrato, numero_bloco: 1, inicio: em(0), fim: em(59), meses: 2, valor: 6400, caucao: 1600, caucao_status: "comprovada", status: "ativo" },
      // O 2º bloco é renovação (0065): precisa do aceite das duas partes.
      { contrato_id: ids.contrato, numero_bloco: 2, inicio: em(60), fim: em(119), meses: 2, valor: 6400, caucao: 1600, status: "agendado", aceite_proprietario_em: agora, aceite_inquilino_em: agora },
    ]);
    if (eb) throw eb;
  });

  test.afterAll(async () => {
    if (ids.contrato) {
      await adm().from("contrato_blocos").delete().eq("contrato_id", ids.contrato);
      await adm().from("contratos").delete().eq("id", ids.contrato);
    }
    await apagarContas([ids.dono, ids.inquilino]);
  });

  for (const w of [390, 1280] as const) {
    test(`1. a ${w} px: Caução por bloco, cada linha com 'Ver contrato'`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await page.goto("/dashboard/garantias", { waitUntil: "domcontentloaded" });
      await expect(page.locator("main h1").first()).toHaveText("Caução", { timeout: 30_000 });
      const linhas = page.getByTestId("caucao-bloco").filter({ visible: true });
      await expect(linhas).toHaveCount(2);
      await expect(linhas.nth(0)).toContainText("Bloco 1");
      await expect(linhas.nth(0)).toContainText("Recebida");
      await expect(linhas.nth(1)).toContainText("Bloco 2");
      await expect(linhas.nth(1)).toContainText("A receber");
      for (const i of [0, 1]) {
        await expect(linhas.nth(i)).toContainText("À vista");
        await expect(linhas.nth(i)).toContainText("Ao fim da estadia");
        await expect(linhas.nth(i).getByTestId("caucao-ver-contrato")).toHaveAttribute("href", `/dashboard/contratos/${ids.contrato}`);
      }
      // O cartão do contrato (blocos, recebimentos) mora só em Contratos.
      await expect(page.getByTestId("caucao-contrato")).toHaveCount(0);
      await page.screenshot({ path: `${SAIDA}/t461-caucao-${w}.png`, fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await page.context().close();
    });
  }

  for (const w of [390, 1280] as const) {
    test(`2. a ${w} px: #conferencia abre o contrato pendente na seção da conferência`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await page.goto("/dashboard/contratos#conferencia", { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(new RegExp(`/dashboard/contratos/${ids.contrato}#conferencia$`), { timeout: 30_000 });
      await expect(page.getByTestId("contrato-conferencia")).toBeVisible({ timeout: 30_000 });
      const etapa = page.getByTestId("estadia-etapa-conferencia-abrir");
      await expect(etapa).toHaveAttribute("href", "#conferencia");
      await page.getByTestId("contrato-conferencia").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t461-conferencia-${w}.png` });
      await page.getByTestId("estadia-linha-tempo").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t461-linha-do-tempo-${w}.png` });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await page.context().close();
    });
  }
});
