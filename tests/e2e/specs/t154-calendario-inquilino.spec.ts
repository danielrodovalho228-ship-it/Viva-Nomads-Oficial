import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo, tornarContratoVigente } from "../fixtures/laboratorio";

/**
 * T154 — ordem 8195c772: o calendário do proprietário mostra a estadia com contrato como PÍLULA com o
 * primeiro nome do inquilino (foto ou iniciais). Candidatura pendente nunca mostra identidade.
 * Roda no laboratório: o próprio teste cria dono, dois inquilinos, imóvel, um contrato vigente e um pedido pendente.
 */
test.describe("T154 — Calendário do proprietário: pílula da estadia", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  const senha = novaSenha();
  const sufixo = novoSufixo();
  const dono = { email: `dono.t153.${sufixo}@lab.vivanomads.test`, nome: "Dora Calendario", role: "owner" as const };
  const inq = { email: `inq.t153.${sufixo}@lab.vivanomads.test`, nome: "Iago Hospede", role: "tenant" as const };
  const pend = { email: `pend.t153.${sufixo}@lab.vivanomads.test`, nome: "Paula Pendente", role: "tenant" as const };
  const ids: { dono?: string; inq?: string; pend?: string; imovel?: string; contrato?: string } = {};

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.pend = await criarConta(pend, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Calendario t153 ${sufixo}`, { ativo: true });
    await criarLead(ids.dono, ids.pend, ids.imovel, false); // candidatura pendente: sem identidade no calendário
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
    await apagarContas([ids.dono, ids.inq, ids.pend]);
  });

  for (const [nome, largura, altura] of [["390 px", 390, 844], ["1280 px", 1280, 800]] as const) {
    test(`dono vê a pílula com o nome do inquilino e nenhuma identidade do pedido pendente — ${nome}`, async ({ browser }) => {
      test.setTimeout(120_000);
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: largura, height: altura });
      await page.goto(`/dashboard/imoveis/${ids.imovel}/editar`, { waitUntil: "domcontentloaded" });
      const pilula = page.getByTestId("pilula-estadia").first();
      await expect(pilula).toBeVisible({ timeout: 25_000 });
      await expect(pilula).toHaveAttribute("aria-label", /^Reservado por Iago, \d{2}\/\d{2} a \d{2}\/\d{2}$/);
      await expect(pilula).toContainText("Iago"); // o nome aparece no primeiro segmento, mesmo truncado
      await expect(pilula.locator("span").first()).toBeVisible(); // avatar (iniciais sem foto) sempre visível
      // Só o primeiro nome e nada do pedido pendente.
      await expect(page.getByText("Hospede")).toHaveCount(0);
      await expect(page.getByText("Paula")).toHaveCount(0);
      // Grade de 7 colunas intacta: sem rolagem lateral.
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(sobra).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `test-results/t154-calendario-${largura}.png`, fullPage: false });
      await page.context().close();
    });
  }
});
