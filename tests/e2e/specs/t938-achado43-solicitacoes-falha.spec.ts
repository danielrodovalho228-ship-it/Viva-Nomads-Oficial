import { test, expect, type Page } from "@playwright/test";
import {
  NO_LABORATORIO,
  adm,
  apagarContas,
  criarConta,
  criarImovelPronto,
  entrar,
  novaSenha,
  novoSufixo,
  tornarContratoVigente,
} from "../fixtures/laboratorio";

/**
 * T938 — #2035 (auditoria de erros e estados vazios, achado 43): em Solicitações (manutenção), a leitura que falhava
 * virava "Nenhuma solicitação ainda" e, sem os contratos, sumia o botão de pedir manutenção. Agora minhasSolicitacoes
 * LANÇA e a tela mostra "Não foi possível carregar as solicitações agora." com "Tentar de novo".
 * Pela tela real, 390 e 1280, morador e dono:
 *   1. leitura boa: o chamado aparece, o botão "Abrir solicitação" fica ativo e não há aviso de falha;
 *   2. a ação do servidor falha (resposta 500 na chamada de minhasSolicitacoes, o mesmo efeito do "throw" novo):
 *      aparece o aviso com "Tentar de novo" — nunca "Nenhuma solicitação ainda", nunca o aviso de "sem contrato";
 *   3. "Tentar de novo" com o servidor de volta: o chamado e o botão voltam, sem recarregar a página.
 * A falha do banco em si (ordens ou contratos) é provada pelo teste de unidade do #2035 (achado43-manutencao.test.ts):
 * daqui não há como quebrar a leitura do Supabase sem tocar em produção.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t938.${sufixo}@lab.vivanomads.test`, nome: "Dora Manutenção", role: "owner" as const };
const morador = { email: `mor.t938.${sufixo}@lab.vivanomads.test`, nome: "Mauro Manutenção", role: "tenant" as const };
const ids: { dono?: string; morador?: string; imovel?: string; contrato?: string } = {};
const DESCRICAO = `Torneira da cozinha pingando (t938 ${sufixo}).`;
const LARGURAS = [390, 1280] as const;

/** Faz a ação do servidor desta tela responder 500 (o "throw" de minhasSolicitacoes chega assim ao navegador). */
async function servidorFalha(page: Page, liga: boolean) {
  const padrao = "**/dashboard/solicitacoes**";
  if (!liga) return page.unroute(padrao);
  await page.route(padrao, (r) =>
    r.request().method() === "POST" && r.request().headers()["next-action"] ? r.fulfill({ status: 500, body: "falha simulada (t938)" }) : r.continue(),
  );
}
async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

test.describe("T938 — #2035 achado 43: Solicitações mostra a falha, não a lista vazia", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio manutenção ${sufixo}`, { ativo: true });
    const { data, error } = await adm()
      .from("contratos")
      .insert({
        property_id: ids.imovel,
        tenant_id: ids.morador,
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
    const { error: e2 } = await adm().from("service_orders").insert({
      property_id: ids.imovel,
      tenant_id: ids.morador,
      owner_id: ids.dono,
      category: "outros",
      priority: "media",
      description: DESCRICAO,
      status: "aberto",
      opened_at: new Date().toISOString(),
    });
    if (e2) throw e2;
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("service_orders").delete().eq("tenant_id", ids.morador ?? "");
    if (ids.contrato) {
      await adm().from("contrato_blocos").delete().eq("contrato_id", ids.contrato);
      await adm().from("contratos").delete().eq("id", ids.contrato);
    }
    await apagarContas([ids.dono, ids.morador]);
  });

  for (const quem of ["morador", "dono"] as const) {
    test(`${quem}: lista boa → falha com "Tentar de novo" → volta, a 390 e 1280`, async ({ browser }) => {
      test.setTimeout(150_000);
      const conta = quem === "morador" ? morador : dono;
      const titulo = quem === "morador" ? "Minhas solicitações" : "Solicitações de manutenção";
      const page = await entrar(browser, conta.email, senha);
      for (const largura of LARGURAS) {
        await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });

        // 1. Leitura boa.
        await servidorFalha(page, false);
        await page.goto("/dashboard/solicitacoes", { waitUntil: "domcontentloaded" });
        await expect(page.getByRole("heading", { name: titulo })).toBeVisible({ timeout: 30_000 });
        await expect(page.getByText(DESCRICAO).first()).toBeVisible();
        await expect(page.getByText("Não foi possível carregar as solicitações agora.")).toHaveCount(0);
        if (quem === "morador") {
          await expect(page.getByRole("button", { name: /Abrir solicitação/ })).toBeEnabled();
          await expect(page.getByTestId("manutencao-sem-contrato")).toHaveCount(0);
        }
        await semRolagemLateral(page);

        // 2. A leitura falha: aviso com "Tentar de novo", nada de lista vazia nem de "sem contrato".
        await servidorFalha(page, true);
        await page.goto("/dashboard/solicitacoes", { waitUntil: "domcontentloaded" });
        await expect(page.getByText("Não foi possível carregar as solicitações agora.")).toBeVisible({ timeout: 30_000 });
        const tentar = page.getByRole("button", { name: "Tentar de novo" });
        await expect(tentar).toBeVisible();
        await expect(page.getByText("Nenhuma solicitação ainda")).toHaveCount(0);
        await expect(page.getByTestId("manutencao-sem-contrato")).toHaveCount(0);
        await expect(page.getByText(DESCRICAO)).toHaveCount(0);
        await semRolagemLateral(page);
        const caixa = await tentar.boundingBox();
        expect(caixa && caixa.x >= 0 && caixa.x + caixa.width <= largura, `"Tentar de novo" inteiro na tela a ${largura}`).toBeTruthy();

        // 3. O servidor volta: "Tentar de novo" recarrega no lugar.
        await servidorFalha(page, false);
        await tentar.click();
        await expect(page.getByText(DESCRICAO).first()).toBeVisible({ timeout: 30_000 });
        await expect(page.getByText("Não foi possível carregar as solicitações agora.")).toHaveCount(0);
        if (quem === "morador") await expect(page.getByRole("button", { name: /Abrir solicitação/ })).toBeEnabled();
      }
      await page.context().close();
    });
  }
});
