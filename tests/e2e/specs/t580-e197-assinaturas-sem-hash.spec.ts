import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, novaSenha, novoSufixo, tornarContratoVigente } from "../fixtures/laboratorio";

/*
  T580 — E197 (#1428), guarda permanente da Pista C, no que a t537 (E165) não cobre: o contrato com as datas de
  assinatura gravadas nas COLUNAS (assinado_*_em) e SEM o registro com hash em contrato_assinaturas. Antes, a lista do
  admin dizia "Assinado pelas duas partes" e o detalhe "Nenhuma assinatura ainda."; agora o detalhe junta as duas fontes:
   - a lista (/admin/contratos) diz "Assinado pelas duas partes";
   - o detalhe (/admin/contratos/[id]) mostra "Proprietário assinou" e "Inquilino assinou", cada uma com o aviso de
     que falta o hash (data-testid "admin-assinatura-sem-hash") e nenhuma linha "Hash do resumo assinado".
  A 1280 e 390 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t580.${sufixo}@lab.vivanomads.test`, nome: "Clara Colunas", role: "owner" as const };
const inquilino = { email: `inq.t580.${sufixo}@lab.vivanomads.test`, nome: "Ivo Colunas", role: "tenant" as const };
const ids: Record<string, string> = {};
const SEM_HASH = "Sem o registro do hash do resumo assinado: só a data gravada no contrato.";

test.describe("T580 — E197: assinaturas só nas colunas do contrato, no detalhe do admin", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inquilino = await criarConta(inquilino, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio colunas t580 ${sufixo}`, { ativo: true });
    ids.lead = await criarLead(ids.dono, ids.inquilino, ids.imovel, true);
    const { data, error } = await adm()
      .from("contratos")
      .insert({
        property_id: ids.imovel,
        tenant_id: ids.inquilino,
        lead_id: ids.lead,
        owner_plan: "essential",
        faixa: "temporada",
        prazo_total_dias: 60,
        aluguel_mensal: 3200,
        tamanho_bloco_meses: 2,
        comissao_percent: 0.08,
        comissao_valor: 512,
        qtd_ocupantes: 1,
        status: "ativo",
        garantia: "caucao",
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
    // Só as colunas assinado_*_em (e o bloco em vigência) — nenhuma linha em contrato_assinaturas.
    await tornarContratoVigente(ids.contrato, ids.dono);
  });
  test.afterAll(async () => {
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    await apagarContas([ids.dono, ids.inquilino]);
  });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: a lista diz 'Assinado pelas duas partes' e o detalhe mostra as duas datas, sem hash`, async ({ browser }) => {
      test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
      const { count } = await adm().from("contrato_assinaturas").select("id", { count: "exact", head: true }).eq("contrato_id", ids.contrato);
      expect(count, "o cenário é SEM registro com hash").toBe(0);
      const page = await (await browser.newContext({ storageState: authFile("admin"), viewport: { width: w, height: w === 390 ? 844 : 900 } })).newPage();

      await page.goto(`/admin/contratos?tipo=todos&q=${ids.contrato.slice(0, 8)}`, { waitUntil: "domcontentloaded" });
      const linha = page.getByTestId("contrato-linha").filter({ has: page.locator(`a[href="/admin/contratos/${ids.contrato}"]`) });
      await expect(linha).toHaveCount(1, { timeout: 30_000 });
      await expect(linha.getByTestId("contrato-assinatura")).toHaveText("Assinado pelas duas partes");

      await page.goto(`/admin/contratos/${ids.contrato}`, { waitUntil: "domcontentloaded" });
      const assinaturas = page.getByTestId("admin-contrato-assinaturas");
      await expect(assinaturas).toBeVisible({ timeout: 30_000 });
      const noDetalhe = (await assinaturas.innerText()).replace(/\s+/g, " ").trim();
      console.log(`t580 ${w}: detalhe="${noDetalhe}"`);
      expect(noDetalhe).not.toContain("Nenhuma assinatura ainda.");
      await expect(assinaturas).toContainText("Proprietário assinou");
      await expect(assinaturas).toContainText("Inquilino assinou");
      await expect(assinaturas.getByTestId("admin-assinatura-sem-hash")).toHaveCount(2);
      await expect(assinaturas.getByTestId("admin-assinatura-sem-hash").first()).toHaveText(SEM_HASH);
      await expect(assinaturas).not.toContainText("Hash do resumo assinado");
      await assinaturas.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `tests/laboratorio/saida/t580-detalhe-${w}.png` });
      await page.context().close();
    });
  }
});
