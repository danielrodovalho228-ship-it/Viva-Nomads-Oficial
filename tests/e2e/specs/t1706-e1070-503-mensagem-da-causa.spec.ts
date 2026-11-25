import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { MSG_ASSINATURA_INATIVA } from "../../../src/lib/contrato-etapas";

/*
  T1706 — E1070 @E1070: quando "Gerar contrato para assinatura" recebe um 503, a mensagem corresponde à causa ou é
  genérica — nunca diz "Assinatura digital ainda não ativa" quando o motivo é outro.
  A rota /api/contrato responde 503 em dois casos diferentes: a assinatura digital inativa (com o modo "inativa") e a
  falha de leitura das partes, dos valores ou da reserva (sem modo, com o texto da causa). A tela tratava os dois como
  assinatura inativa. As respostas são simuladas no navegador (a falha de leitura não se provoca de fora); o resto é o
  app real do laboratório.
   1. 503 com o texto da causa ("Não foi possível conferir o fechamento agora…"): a tela mostra ESSE texto.
   2. 503 sem corpo (o servidor caiu antes de responder): a tela mostra a mensagem genérica.
   3. 503 com o modo "inativa": a tela continua a dizer que a assinatura digital não está ativa.
   4. Sem simulação: o contrato é gerado (o caminho real continua a funcionar).
  Em nenhuma das recusas um contrato é gravado. Capturas a 390 e a 1280 px do caso 1. Laboratório; não é prova ao vivo.
*/
const SAIDA = "tests/laboratorio/saida";
const ROTULO_BOTAO = "Gerar contrato para assinatura";
// Os textos que a rota manda (conferidos contra o código do servidor na trava de unidade do E1070).
const MSG_SEM_LEITURA = "Não foi possível conferir o fechamento agora. Tente de novo em instantes.";
const MSG_GENERICA = "Não foi possível gerar o contrato. Tente de novo.";
const emDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1706.${sufixo}@lab.vivanomads.test`, nome: "Dora Causa Sobrenome", role: "owner" as const };
const inq = { email: `inq.t1706.${sufixo}@lab.vivanomads.test`, nome: "Iris Causa Sobrenome", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; lead?: string } = {};

const contratosDoLead = async () => ((await adm().from("contratos").select("id").eq("lead_id", ids.lead!)).data ?? []).length;

/** A próxima resposta de /api/contrato é a simulada; o pedido não chega ao servidor. */
async function simular(page: Page, resposta: { status: number; corpo: string; tipo: string }) {
  await page.unroute("**/api/contrato");
  await page.route("**/api/contrato", (rota) => rota.fulfill({ status: resposta.status, contentType: resposta.tipo, body: resposta.corpo }));
}

/** Clica e espera o pedido acabar: o botão passa por "Gerando..." e volta ao rótulo (o contrato não saiu). */
async function clicarEVoltar(page: Page) {
  const botao = page.getByTestId("fechamento-gerar-contrato");
  await botao.scrollIntoViewIfNeeded();
  await botao.click();
  await expect(botao, "o botão volta depois da recusa").toHaveText(ROTULO_BOTAO, { timeout: 40_000 });
  await expect(botao).toBeEnabled();
}

test.describe("T1706 — E1070: o 503 de \"Gerar contrato\" diz a causa certa @E1070", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.setTimeout(240_000);

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    // Contas de teste: sem simulação, o contrato sai no modo TESTE (sem assinatura digital real).
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    ids.imovel = await criarImovelPronto(ids.dono, `[TESTE QA] Studio causa ${sufixo}`, { ativo: true, preco: 2800 });
    const { error: e1 } = await adm()
      .from("properties")
      .update({ condo_fee: 0, utilities_mode: "fixed", utilities_estimate: 250, prep_fee: 300, checkout_cleaning_enabled: false, checkout_cleaning_fee: 0, limpeza_estadia: null, min_period_days: 30, max_period_days: 180 })
      .eq("id", ids.imovel);
    if (e1) throw e1;
    const { data, error } = await adm()
      .from("leads")
      .insert({ owner_id: ids.dono, tenant_id: ids.inq, property_id: ids.imovel, status: "accepted", inicio_desejado: emDias(30), fim_desejado: emDias(90) })
      .select("id")
      .single();
    if (error) throw error;
    ids.lead = data.id as string;
    for (const tipo of ["identidade", "vinculo"]) {
      const u = () => crypto.randomUUID();
      const { error: e2 } = await adm().from("documentos_inquilino").insert({ lead_id: ids.lead, tenant_id: ids.inq, tipo, caminho: `${u()}/${u()}/${u()}.pdf`, hash_sha256: "a".repeat(64) });
      if (e2) throw e2;
    }
  });

  test.afterAll(async () => {
    if (ids.lead) {
      await adm().from("cobrancas_fechamento").delete().eq("lead_id", ids.lead);
      await adm().from("contratos").delete().eq("lead_id", ids.lead);
    }
    if (ids.imovel) await adm().from("messages").delete().eq("property_id", ids.imovel);
    await apagarContas([ids.dono, ids.inq]);
  });

  test("a recusa 503 mostra a causa que o servidor mandou, a genérica ou a assinatura inativa — cada uma no seu caso", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/dashboard/fechamento?c=${ids.lead}`, { waitUntil: "domcontentloaded" });
    await page.locator("main").first().waitFor();
    await page.getByRole("button", { name: /verificar identidade/i }).click();
    const continuar = page.getByRole("button", { name: /continuar/i });
    await expect(continuar).toBeEnabled({ timeout: 20_000 });
    await continuar.click();
    await page.getByRole("radio").and(page.locator(":not([disabled])")).first().click();
    await page.getByTestId("ciente-protecao").check({ timeout: 15_000 });
    await continuar.click();
    await expect(page.getByRole("heading", { name: /serviços adicionais/i })).toBeVisible({ timeout: 15_000 });
    await continuar.click();
    await page.getByRole("button", { name: /Seguir sem seguro patrimonial/ }).click();
    await continuar.click();
    await expect(page.getByTestId("marca-minuta")).toBeVisible({ timeout: 15_000 });
    const erro = page.getByTestId("erro-contrato");

    await test.step("1. 503 com o texto da causa: a tela mostra esse texto, não a assinatura inativa", async () => {
      await simular(page, { status: 503, tipo: "application/json", corpo: JSON.stringify({ error: MSG_SEM_LEITURA }) });
      await clicarEVoltar(page);
      await expect(erro).toHaveText(MSG_SEM_LEITURA);
      await expect(page.getByText(MSG_ASSINATURA_INATIVA)).toHaveCount(0);
      await erro.scrollIntoViewIfNeeded();
      await erro.screenshot({ path: `${SAIDA}/t1706-1-causa-do-servidor-1280.png` });
      await page.setViewportSize({ width: 390, height: 844 });
      await erro.scrollIntoViewIfNeeded();
      await expect(erro).toBeInViewport({ ratio: 1 });
      await erro.screenshot({ path: `${SAIDA}/t1706-1-causa-do-servidor-390.png` });
      await page.setViewportSize({ width: 1280, height: 900 });
      expect(await contratosDoLead(), "nenhum contrato foi gravado").toBe(0);
    });

    await test.step("2. 503 sem corpo: a tela mostra a mensagem genérica, não a assinatura inativa", async () => {
      await simular(page, { status: 503, tipo: "text/html", corpo: "<html><body>Service Unavailable</body></html>" });
      await clicarEVoltar(page);
      await expect(erro).toHaveText(MSG_GENERICA);
      await expect(page.getByText(MSG_ASSINATURA_INATIVA)).toHaveCount(0);
      expect(await contratosDoLead()).toBe(0);
    });

    await test.step("3. 503 com o modo \"inativa\": a tela continua a dizer que a assinatura digital não está ativa", async () => {
      await simular(page, { status: 503, tipo: "application/json", corpo: JSON.stringify({ modo: "inativa", error: MSG_ASSINATURA_INATIVA }) });
      await clicarEVoltar(page);
      await expect(erro).toHaveText(MSG_ASSINATURA_INATIVA);
      expect(await contratosDoLead()).toBe(0);
    });

    await test.step("4. sem simulação: o contrato é gerado", async () => {
      await page.unroute("**/api/contrato");
      await page.getByTestId("fechamento-gerar-contrato").click();
      await expect(page.getByTestId("fechamento-abrir-contrato")).toBeVisible({ timeout: 40_000 });
      await expect(erro).toHaveCount(0);
      await expect.poll(contratosDoLead, { timeout: 20_000 }).toBe(1);
    });
    await page.context().close();
  });
});
