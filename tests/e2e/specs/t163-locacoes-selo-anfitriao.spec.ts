import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo, tornarContratoVigente } from "../fixtures/laboratorio";

/**
 * T163 — ordem 8195c772 item 2: em /dashboard/locacoes o INQUILINO vê o selo do anfitrião
 * (foto ou iniciais + primeiro nome) na própria estadia. Só o primeiro nome, nunca o sobrenome.
 * Roda no laboratório: o próprio teste cria dono, inquilino, imóvel e um contrato vigente.
 */
test.describe("T163 — Minhas locações: selo do anfitrião", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  const senha = novaSenha();
  const sufixo = novoSufixo();
  const dono = { email: `dono.t163.${sufixo}@lab.vivanomads.test`, nome: "Dora Anfitriao", role: "owner" as const };
  const inq = { email: `inq.t163.${sufixo}@lab.vivanomads.test`, nome: "Iago Hospede", role: "tenant" as const };
  const ids: { dono?: string; inq?: string; imovel?: string; contrato?: string } = {};

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Selo t163 ${sufixo}`, { ativo: true });
    const { data, error } = await adm()
      .from("contratos")
      .insert({
        property_id: ids.imovel,
        tenant_id: ids.inq,
        owner_plan: "essential",
        faixa: "temporada",
        prazo_total_dias: 60,
        aluguel_mensal: 3200,
        tamanho_bloco_meses: 2,
        comissao_percent: 0.08,
        comissao_valor: 256,
        qtd_ocupantes: 1,
        status: "ativo",
        garantia: "caucao",
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
    await tornarContratoVigente(ids.contrato, ids.dono);
  });

  test.afterAll(async () => {
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const [nome, largura, altura] of [["390 px", 390, 844], ["1280 px", 1280, 800]] as const) {
    test(`inquilino vê o selo com o primeiro nome do anfitrião — ${nome}`, async ({ browser }) => {
      test.setTimeout(120_000);
      const page = await entrar(browser, inq.email, senha);
      await page.setViewportSize({ width: largura, height: altura });
      await page.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
      const selo = page.getByTestId("locacao-selo").first();
      await expect(selo).toBeVisible({ timeout: 25_000 });
      await expect(selo).toContainText("Dora");
      await expect(page.getByText("Anfitriao")).toHaveCount(0); // só o primeiro nome
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(sobra).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `test-results/t163-locacoes-${largura}.png`, fullPage: false });
      await page.context().close();
    });
  }
});
