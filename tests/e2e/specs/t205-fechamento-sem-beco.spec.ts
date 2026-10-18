import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { ROTULO_ETAPA } from "../../../src/lib/contrato-etapas";

/*
  T205 — Prompt 24 (QA do Muse, 18/10): "Gerar contrato" virou beco sem saída na conta de teste.
  Dono e inquilina NOVOS, os dois is_teste (o mesmo caso do inquilino1 × proprietario1 com o anúncio [TESTE QA]).
   1. Dono (1280): fechamento pela tela até "Gerar contrato"; DOIS cliques seguidos em Gerar não travam; "Continuar"
      destrava e o Resumo aparece. Um contrato só, com a marca de minuta; taxa de serviço simulada (nada cobrado).
      A Caução aparece ao lado do 1º pagamento, fora dele, com o total antes da entrada.
   2. Recarregar no meio (390): a página volta do zero, "Gerar" de novo devolve o contrato existente e destrava.
   3. O contrato aparece nos dois lados: dono em Contratos & blocos ("falta você e o inquilino"); inquilina em Minhas
      estadias e no cartão da candidatura; o aviso "pronto para assinar" chega à caixa de teste da inquilina.
   4. As duas assinaturas pela tela, com o código de 6 dígitos lido na caixa de teste de cada parte → "As duas partes
      assinaram", a locação segue ativa nos dois lados e o "contrato assinado" chega às duas caixas.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t205.${sufixo}@lab.vivanomads.test`, nome: "Paulo Fechamento Sobrenome", role: "owner" as const };
const inq = { email: `inq.t205.${sufixo}@lab.vivanomads.test`, nome: "Iara Fechamento Sobrenome", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; lead?: string; contrato?: string } = {};
const SAIDA = "tests/laboratorio/saida";
const ALUGUEL = 3200;

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

async function abrir(page: Page, rota: string) {
  await page.goto(rota, { waitUntil: "domcontentloaded" });
  await page.locator("main").first().waitFor();
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}

/** Do início do fechamento até a etapa "Contrato" (conta de teste: verificação segue com a pendência registrada). */
async function ateContrato(page: Page) {
  await abrir(page, `/dashboard/fechamento?c=${ids.lead}`);
  await expect(page.getByRole("heading", { name: "Candidatura e verificação" })).toBeVisible({ timeout: 20_000 });
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
}

async function codigoDaCaixa(usuarioId: string, depoisDe: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const { data } = await adm()
      .from("emails_teste")
      .select("corpo")
      .eq("usuario_id", usuarioId)
      .eq("evento", "contract_signature_code")
      .gte("criado_em", depoisDe)
      .order("criado_em", { ascending: false })
      .limit(1);
    const m = /\b(\d{6})\b/.exec(String(data?.[0]?.corpo ?? ""));
    if (m) return m[1];
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("O código de assinatura não chegou à caixa de testes em 30 s.");
}

async function assuntosDaCaixa(usuarioId: string): Promise<string[]> {
  const { data } = await adm().from("emails_teste").select("assunto").eq("usuario_id", usuarioId);
  return ((data ?? []) as { assunto: string }[]).map((r) => r.assunto);
}

async function assinarPelaTela(browser: Browser, quem: { email: string; id: string }, rota: string, largura: number) {
  const page = await entrar(browser, quem.email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  await abrir(page, rota);
  await expect(page.getByTestId("form-assinar")).toBeVisible({ timeout: 20_000 });
  const antes = new Date(Date.now() - 2_000).toISOString();
  await page.getByTestId("assinar-pedir-codigo").click();
  await expect(page.getByText(/Enviamos 6 números/)).toBeVisible({ timeout: 45_000 });
  await page.getByTestId("assinar-aceite").check();
  await page.getByTestId("assinar-codigo").fill(await codigoDaCaixa(quem.id, antes));
  await page.getByTestId("assinar-enviar").click();
  await expect(page.getByTestId("form-assinar")).toHaveCount(0, { timeout: 45_000 });
  return page;
}

test.describe("T205 — fechamento: 'Gerar contrato' sem beco, dos dois lados até as duas assinaturas (prompt 24)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha, true);
    ids.inq = await criarConta(inq, senha, true);
    const { error: eTeste } = await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    if (eTeste) throw eTeste;
    ids.imovel = await criarImovelPronto(ids.dono, `[TESTE QA] Fechamento ${sufixo}`, { ativo: true, preco: ALUGUEL });
    ids.lead = await criarLead(ids.dono, ids.inq, ids.imovel, true);
    await adm().from("leads").update({ accepted_commission_rate: 0.12, accepted_plan: "essential" }).eq("id", ids.lead);
    for (const tipo of ["identidade", "vinculo"]) {
      const u = () => crypto.randomUUID();
      const { error } = await adm()
        .from("documentos_inquilino")
        .insert({ lead_id: ids.lead, tenant_id: ids.inq, tipo, caminho: `${u()}/${u()}/${u()}.pdf`, hash_sha256: "a".repeat(64) });
      if (error) throw error;
    }
  });

  test.afterAll(async () => {
    if (ids.lead) await adm().from("cobrancas_fechamento").delete().eq("lead_id", ids.lead);
    if (ids.lead) await adm().from("contratos").delete().eq("lead_id", ids.lead);
    if (ids.imovel) await adm().from("messages").delete().eq("property_id", ids.imovel);
    await apagarContas([ids.dono, ids.inq]);
  });

  test("1. 1280 — dois cliques em Gerar não travam; Continuar destrava; Resumo; Caução ao lado do 1º pagamento", async ({ browser }) => {
    test.setTimeout(180_000);
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await ateContrato(page);

    // Caução FORA do 1º pagamento, mostrada ao lado, com o total antes da entrada (Daniel, 18/10).
    await expect(page.getByTestId("entrada-primeiro-pagamento")).toContainText("3.930");
    await expect(page.getByTestId("entrada-caucao")).toContainText("devolvida no fim, conforme a conferência de saída");
    await expect(page.getByTestId("entrada-total")).toContainText("Total antes da entrada");
    await page.getByTestId("entrada-caucao").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SAIDA}/t205-caucao-1280.png`, fullPage: false });

    // Dois cliques seguidos: o 2º é ignorado (botão ocupado) ou devolve o contrato existente — nunca trava.
    const gerar = page.getByTestId("fechamento-gerar-contrato");
    await gerar.dblclick();
    await expect(page.getByTestId("fechamento-abrir-contrato")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("erro-contrato")).toHaveCount(0);
    await expect(page.getByText(/Contrato de TESTE registrado/)).toBeVisible();
    await page.screenshot({ path: `${SAIDA}/t205-gerado-1280.png`, fullPage: true });
    await semRolagemLateral(page);

    const continuar = page.getByRole("button", { name: /continuar/i });
    await expect(continuar).toBeEnabled();
    await continuar.click();
    await expect(page.getByRole("heading", { name: "Fechamento concluído" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("TESTE · aguardando assinatura")).toBeVisible();
    await page.screenshot({ path: `${SAIDA}/t205-resumo-1280.png`, fullPage: true });

    // Um contrato só, com blocos; reserva concluída com o id simulado; taxa de serviço simulada (nada cobrado).
    const { data: contratos } = await adm().from("contratos").select("id, contrato_blocos(id)").eq("lead_id", ids.lead!);
    expect(contratos ?? []).toHaveLength(1);
    ids.contrato = contratos![0].id as string;
    expect(((contratos![0] as { contrato_blocos: unknown[] }).contrato_blocos ?? []).length).toBeGreaterThan(0);
    const { data: reservas } = await adm().from("cobrancas_fechamento").select("tipo, externo_id").eq("lead_id", ids.lead!);
    const porTipo = Object.fromEntries(((reservas ?? []) as { tipo: string; externo_id: string | null }[]).map((r) => [r.tipo, r.externo_id]));
    expect(porTipo.contrato ?? "").toMatch(/^teste_/);
    await expect.poll(async () => {
      const { data } = await adm().from("cobrancas_fechamento").select("externo_id").eq("lead_id", ids.lead!).eq("tipo", "comissao").maybeSingle();
      return String(data?.externo_id ?? "");
    }, { timeout: 15_000 }).toMatch(/teste|demo/i);
    await page.context().close();
  });

  test("2. 390 — recarregar no meio não trava: Gerar de novo devolve o contrato existente e destrava", async ({ browser }) => {
    test.setTimeout(180_000);
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 390, height: 844 });
    await ateContrato(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await ateContrato(page);
    await page.getByTestId("fechamento-gerar-contrato").click();
    await expect(page.getByTestId("fechamento-abrir-contrato")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: /continuar/i })).toBeEnabled();
    await semRolagemLateral(page);
    await page.screenshot({ path: `${SAIDA}/t205-gerado-de-novo-390.png`, fullPage: true });
    // A API, chamada de novo, responde 200 com o existente (nunca 409).
    const r = await page.request.post("/api/contrato", { data: { leadId: ids.lead, termMonths: 3, guarantee: "Caução", costSplit: {} } });
    expect(r.status()).toBe(200);
    expect(await r.json()).toMatchObject({ modo: "teste", existente: true });
    expect((await adm().from("contratos").select("id").eq("lead_id", ids.lead!)).data ?? []).toHaveLength(1);
    await page.context().close();
  });

  test("3. o contrato aparece nos dois lados, com quem falta assinar; aviso na caixa de teste da inquilina", async ({ browser }) => {
    test.setTimeout(150_000);
    const pd = await entrar(browser, dono.email, senha);
    for (const largura of [1280, 390]) {
      await pd.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await abrir(pd, "/dashboard/contratos");
      await expect(pd.getByTestId("contrato-assinatura-status").first()).toHaveText("Aguardando assinatura · falta você e o inquilino", { timeout: 20_000 });
      await semRolagemLateral(pd);
      await pd.screenshot({ path: `${SAIDA}/t205-dono-contratos-${largura}.png`, fullPage: true });
    }
    await pd.context().close();

    const pi = await entrar(browser, inq.email, senha);
    for (const largura of [390, 1280]) {
      await pi.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await abrir(pi, "/dashboard/candidaturas");
      await expect(pi.getByTestId("candidatura-contrato-status").first()).toHaveText("Aguardando assinatura · falta você e o proprietário", { timeout: 20_000 });
      await semRolagemLateral(pi);
      await pi.screenshot({ path: `${SAIDA}/t205-inquilina-candidatura-${largura}.png`, fullPage: true });
      await abrir(pi, "/dashboard/locacoes");
      await expect(pi.getByTestId("locacao-etapa").first()).toHaveText(ROTULO_ETAPA.aguardando_assinatura, { timeout: 20_000 });
    }
    await pi.context().close();
    await expect.poll(() => assuntosDaCaixa(ids.inq!), { timeout: 20_000 }).toContain("Seu contrato está pronto para assinar");
  });

  test("4. as duas assinaturas pela tela (código na caixa de teste) → assinado dos dois lados; e-mail para os dois", async ({ browser }) => {
    test.setTimeout(240_000);
    // O proprietário só assina com as instruções de entrada preenchidas (Check-in garantido, conferido no servidor).
    const { error: eCheckin } = await adm()
      .from("contratos_checkin")
      .insert({ contrato_id: ids.contrato, horario: "14:00", instrucoes: "Chave na portaria, apto 12.", plantao: "34999990000" });
    expect(eCheckin).toBeNull();

    const pi = await assinarPelaTela(browser, { email: inq.email, id: ids.inq! }, `/dashboard/locacoes/${ids.contrato}`, 390);
    await expect(pi.getByTestId("contrato-aviso-assinatura")).toHaveText("Você já assinou — falta o proprietário assinar.");
    await pi.screenshot({ path: `${SAIDA}/t205-inquilina-assinou-390.png`, fullPage: true });
    await pi.context().close();

    const pd = await assinarPelaTela(browser, { email: dono.email, id: ids.dono! }, `/dashboard/contratos/${ids.contrato}`, 1280);
    await expect(pd.getByTestId("contrato-aviso-assinatura")).toHaveText("As duas partes assinaram.");
    await pd.screenshot({ path: `${SAIDA}/t205-dono-assinou-1280.png`, fullPage: true });
    // Locação ativa no painel do dono: sai de "Aguardando assinatura" e segue para o 1º pagamento.
    await abrir(pd, "/dashboard/contratos");
    await expect(pd.getByTestId("contrato-etapa").first()).toHaveText(ROTULO_ETAPA.aguardando_pagamento, { timeout: 20_000 });
    await pd.context().close();

    const { data } = await adm().from("contratos").select("status, assinado_inquilino_em, assinado_proprietario_em").eq("id", ids.contrato!).single();
    expect(data?.status).toBe("ativo");
    expect(data?.assinado_inquilino_em).not.toBeNull();
    expect(data?.assinado_proprietario_em).not.toBeNull();

    const pi2 = await entrar(browser, inq.email, senha);
    for (const largura of [390, 1280]) {
      await pi2.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await abrir(pi2, "/dashboard/locacoes");
      await expect(pi2.getByTestId("locacao-etapa").first()).toHaveText(ROTULO_ETAPA.aguardando_pagamento, { timeout: 20_000 });
      await semRolagemLateral(pi2);
      await pi2.screenshot({ path: `${SAIDA}/t205-inquilina-locacao-${largura}.png`, fullPage: true });
    }
    await pi2.context().close();

    for (const id of [ids.inq!, ids.dono!]) {
      await expect.poll(() => assuntosDaCaixa(id), { timeout: 20_000 }).toContain("As duas partes assinaram o contrato");
    }
  });
});
