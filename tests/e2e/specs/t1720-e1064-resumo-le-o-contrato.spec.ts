import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1720 — E1064 @E1064, perna 2 (ORDEM-DUET-392): o Resumo (passo 6) do Fechamento lê o estado REAL do contrato.
  A prova ao vivo de 21/11: com o contrato já assinado, o Resumo continuava inacessível — só abria gerando de novo.
  Massa: uma candidatura ANTIGA com contrato já assinado pelas duas partes (garantia caução, criado em 12/10/2026) e
  uma candidatura SEM contrato, do mesmo dono.
   1. Com contrato: o Fechamento reaberto oferece "Ver o resumo" e a etapa "Resumo" da barra fica clicável, sem gerar
      de novo. O Resumo diz a situação real do contrato, "Gerado em 12/10/2026", a garantia gravada nele e os links.
      Não mostra o que o contrato não guarda (serviços adicionais, seguro patrimonial) nem a conta da taxa desta visita.
   2. Sem contrato: nada muda — a etapa "Resumo" continua fechada e não há "Ver o resumo".
  A 390 e a 1280 px. As procuras são pelo texto que a tela mostra. Laboratório; não é prova ao vivo no site.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1720.${sufixo}@lab.vivanomads.test`, nome: "Paula Resumo Sobrenome", role: "owner" as const };
const inq = { email: `inq.t1720.${sufixo}@lab.vivanomads.test`, nome: "Ivo Resumo Sobrenome", role: "tenant" as const };
const ids: Record<string, string> = {};

async function docs(lead: string) {
  for (const tipo of ["identidade", "vinculo"]) {
    const u = () => crypto.randomUUID();
    await adm().from("documentos_inquilino").insert({ lead_id: lead, tenant_id: ids.inq, tipo, caminho: `${u()}/${u()}/${u()}.pdf`, hash_sha256: "a".repeat(64) });
  }
}
async function noFechamento(browser: Browser, lead: string, largura: 390 | 1280): Promise<Page> {
  const page = await entrar(browser, dono.email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  await page.goto(`/dashboard/fechamento?c=${lead}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Candidatura e verificação" })).toBeVisible({ timeout: 30_000 });
  return page;
}
/** A etapa "Resumo" da barra de etapas (o botão "6 Resumo"). */
const etapaResumo = (page: Page) => page.getByRole("button", { name: /^6\s*Resumo$/ });

test.describe("T1720 — E1064: o Resumo do Fechamento lê o estado real do contrato @E1064", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha, true);
    ids.inq = await criarConta(inq, senha, true);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    ids.imovel = await criarImovelPronto(ids.dono, `[TESTE QA] Resumo ${sufixo}`, { ativo: true, preco: 3200 });
    // Candidatura antiga, com contrato já assinado pelas duas partes (o caso da prova ao vivo).
    ids.leadComContrato = await criarLead(ids.dono, ids.inq, ids.imovel, true);
    await adm().from("leads").update({ accepted_commission_rate: 0.12, accepted_plan: "essential" }).eq("id", ids.leadComContrato);
    await docs(ids.leadComContrato);
    const { data: c, error } = await adm()
      .from("contratos")
      .insert({ lead_id: ids.leadComContrato, property_id: ids.imovel, tenant_id: ids.inq, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: 120, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.12, comissao_valor: 1536, qtd_ocupantes: 1, garantia: "caucao", status: "ativo", created_at: "2026-10-12T15:00:00Z", assinado_proprietario_em: "2026-10-12T16:00:00Z", assinado_inquilino_em: "2026-10-12T16:05:00Z" })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = c.id as string;
  });

  test.afterAll(async () => {
    await adm().from("cobrancas_fechamento").delete().in("lead_id", [ids.leadComContrato, ids.leadSemContrato].filter(Boolean));
    await adm().from("contratos").delete().eq("property_id", ids.imovel);
    await adm().from("leads").delete().eq("owner_id", ids.dono);
    await apagarContas([ids.inq, ids.dono]);
  });

  for (const largura of [1280, 390] as const) {
    test(`1. com contrato já assinado, a ${largura} px: o Resumo abre sem gerar de novo e diz o que o contrato guarda`, async ({ browser }) => {
      const page = await noFechamento(browser, ids.leadComContrato, largura);
      const aviso = page.getByTestId("fechamento-contrato-existente");
      await expect(aviso).toContainText("Esta candidatura já tem contrato.");
      // A etapa "Resumo" da barra fica clicável pelo estado real (antes: só depois de "Gerar contrato").
      await expect(etapaResumo(page), "a etapa Resumo fica acessível").toBeEnabled();
      await aviso.getByTestId("fechamento-ver-resumo").click();
      await expect(page.getByRole("heading", { name: "Fechamento concluído" })).toBeVisible({ timeout: 15_000 });

      const quadro = page.getByText("Identidade do morador", { exact: true }).locator("xpath=../..");
      // A situação real do contrato (a mesma do aviso do topo), a data em que foi gerado e os links.
      const situacao = (await aviso.locator("strong").innerText()).trim();
      expect(situacao.length, "o aviso diz a situação do contrato").toBeGreaterThan(3);
      await expect(quadro.getByText("Contrato", { exact: true }).locator("xpath=..")).toContainText(situacao);
      await expect(quadro.getByText(/aguardando assinatura/i), "o contrato está assinado pelas duas partes").toHaveCount(0);
      await expect(page.getByTestId("resumo-contrato")).toContainText("Gerado em 12/10/2026");
      await expect(page.getByTestId("resumo-ver-contrato")).toHaveAttribute("href", `/dashboard/contratos/${ids.contrato}`);
      await expect(page.getByTestId("resumo-ver-estadia")).toHaveAttribute("href", `/dashboard/estadia/${ids.contrato}`);
      // A garantia é a gravada no contrato.
      await expect(quadro.getByText("Garantia", { exact: true }).locator("xpath=..")).toContainText("Caução");
      // O que o contrato não guarda não aparece (nada de "Nenhum" / "Não contratado" inventado).
      await expect(quadro.getByText("Serviços adicionais")).toHaveCount(0);
      await expect(quadro.getByText("Seguro patrimonial")).toHaveCount(0);
      await expect(quadro.getByText(/Taxa de serviço/)).toHaveCount(0);
      await expect(quadro.getByText("Pendente", { exact: true }), "o contrato não aparece como pendente").toHaveCount(0);
      await page.getByRole("heading", { name: "Fechamento concluído" }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t1720-1-resumo-pelo-contrato-${largura}.png` });

      // Também pela barra de etapas: volta ao passo 1 e abre o Resumo pelo botão da etapa.
      // (uma etapa já passada mostra um visto no lugar do número: o botão chama-se só "Candidatura & verificação")
      await page.getByRole("button", { name: "Candidatura & verificação" }).click();
      await expect(page.getByRole("heading", { name: "Candidatura e verificação" })).toBeVisible();
      await etapaResumo(page).click();
      await expect(page.getByRole("heading", { name: "Fechamento concluído" })).toBeVisible({ timeout: 15_000 });
      await page.context().close();
    });
  }

  test("2. sem contrato: a etapa Resumo continua fechada e não há 'Ver o resumo'", async ({ browser }) => {
    ids.leadSemContrato = await criarLead(ids.dono, ids.inq, ids.imovel, true);
    await adm().from("leads").update({ accepted_commission_rate: 0.12, accepted_plan: "essential" }).eq("id", ids.leadSemContrato);
    await docs(ids.leadSemContrato);
    const page = await noFechamento(browser, ids.leadSemContrato, 1280);
    await expect(page.getByTestId("fechamento-contrato-existente")).toHaveCount(0);
    await expect(page.getByTestId("fechamento-ver-resumo")).toHaveCount(0);
    await expect(etapaResumo(page)).toBeDisabled();
    await page.context().close();
  });
});
