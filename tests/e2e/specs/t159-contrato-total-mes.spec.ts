import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T159 — ordem ddcda0fa (#699): o resumo do contrato mostra "Total por mês" quando o imóvel tem limpeza paga
 * (2.400 + condomínio 350 + contas fixas 200 + limpeza 180 = 3.130) e NÃO muda o resumo de um contrato que foi
 * assinado antes de o total existir (sem `outrosCustosMes` congelado). Setup semeado pelo próprio teste.
 */
test.describe("T159 — Contrato: Total por mês no resumo", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  const senha = novaSenha();
  const sufixo = novoSufixo();
  const dono = { email: `dono.t159.${sufixo}@lab.vivanomads.test`, nome: "Dora Total", role: "owner" as const };
  const inq = { email: `inq.t159.${sufixo}@lab.vivanomads.test`, nome: "Iago Total", role: "tenant" as const };
  const ids: { dono?: string; inq?: string; imovel?: string; novo?: string; antigo?: string } = {};
  const limpezaEstadia = { porMes: 2, inclui: "", valorMes: 180 };

  const contrato = (extra: Record<string, unknown>) => ({
    property_id: ids.imovel,
    tenant_id: ids.inq,
    owner_plan: "essential",
    faixa: "temporada",
    prazo_total_dias: 60,
    aluguel_mensal: 2400,
    tamanho_bloco_meses: 2,
    comissao_percent: 0.08,
    comissao_valor: 192,
    qtd_ocupantes: 1,
    status: "ativo",
    garantia: "caucao",
    ...extra,
  });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Total t159 ${sufixo}`, { ativo: true, preco: 2400 });
    const { error: eImovel } = await adm()
      .from("properties")
      .update({ condo_fee: 350, utilities_mode: "fixed", utilities_estimate: 200, limpeza_estadia: limpezaEstadia })
      .eq("id", ids.imovel);
    if (eImovel) throw eImovel;
    const novo = await adm().from("contratos").insert(contrato({})).select("id").single();
    if (novo.error) throw novo.error;
    ids.novo = novo.data.id as string;
    // Já assinado pelo dono ANTES de o total existir: limpeza congelada, mas sem `outrosCustosMes`.
    const antigo = await adm()
      .from("contratos")
      .insert(contrato({ assinado_proprietario_em: new Date().toISOString(), pets_regras_congeladas: { limpezaEstadia } }))
      .select("id")
      .single();
    if (antigo.error) throw antigo.error;
    ids.antigo = antigo.data.id as string;
  });

  test.afterAll(async () => {
    for (const id of [ids.novo, ids.antigo]) if (id) await adm().from("contratos").delete().eq("id", id);
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const largura of [390, 1280]) {
    test(`contrato novo: resumo com "Total por mês: R$ 3.130,00"; contrato assinado antes não ganha a linha (${largura} px)`, async ({ browser }) => {
      test.setTimeout(120_000);
      const page = await entrar(browser, inq.email, senha);
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto(`/dashboard/locacoes/${ids.novo}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("contrato-resumo")).toContainText(/Total por mês: R\$\s3\.130,00/, { timeout: 20_000 });
      await expect(page.getByTestId("contrato-resumo")).toContainText("Limpeza");

      await page.goto(`/dashboard/locacoes/${ids.antigo}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("contrato-resumo")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("contrato-resumo")).not.toContainText("Total por mês");
      await page.context().close();
    });
  }
});
