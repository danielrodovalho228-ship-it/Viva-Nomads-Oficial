import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo, tornarContratoVigente } from "../fixtures/laboratorio";

/*
  T210 — Prompt 28 (reteste do #840). 390 e 1280 px.
   1. O Resumo do Fechamento mostra o estado REAL do contrato: com contrato já assinado pelas duas partes →
      "As duas partes assinaram · Aguardando 1º pagamento" + "Este contrato foi gerado em …" + "Ver contrato"; com
      contrato novo → "Aguardando assinatura · falta você e o inquilino".
   2. "Contratos" no painel do inquilino (com o número do que falta assinar no menu); Locações só com as assinadas.
   3. 1º pagamento → "Locação ativa" nos dois lados.
   4. /admin › Dados de teste › "Nova jornada de teste": cria candidatura nova pronta para o Fechamento; de novo →
      devolve a mesma (idempotente); a candidatura e o contrato antigos ficam.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t210.${sufixo}@lab.vivanomads.test`, nome: "Paula Estado Sobrenome", role: "owner" as const };
const inq = { email: `inq.t210.${sufixo}@lab.vivanomads.test`, nome: "Ivo Estado Sobrenome", role: "tenant" as const };
const ids: Record<string, string> = {};

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}
async function abrir(page: Page, rota: string) {
  await page.goto(rota, { waitUntil: "domcontentloaded" });
  await page.locator("main").first().waitFor();
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}
async function docs(lead: string) {
  for (const tipo of ["identidade", "vinculo"]) {
    const u = () => crypto.randomUUID();
    await adm().from("documentos_inquilino").insert({ lead_id: lead, tenant_id: ids.inq, tipo, caminho: `${u()}/${u()}/${u()}.pdf`, hash_sha256: "a".repeat(64) });
  }
}
/** Fechamento pela tela até "Gerar contrato" e o Resumo. */
async function gerarAteResumo(page: Page, lead: string) {
  await abrir(page, `/dashboard/fechamento?c=${lead}`);
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
  await page.getByTestId("fechamento-gerar-contrato").click();
  await expect(page.getByTestId("fechamento-estado-contrato")).toBeVisible({ timeout: 30_000 });
  await continuar.click();
  await expect(page.getByRole("heading", { name: "Fechamento concluído" })).toBeVisible({ timeout: 15_000 });
}

test.describe("T210 — estado real do contrato, Contratos do inquilino e jornada de teste (prompt 28)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha, true);
    ids.inq = await criarConta(inq, senha, true);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    ids.imovel = await criarImovelPronto(ids.dono, `[TESTE QA] Estado ${sufixo}`, { ativo: true, preco: 3200 });
    // Candidatura ANTIGA, com contrato já assinado pelas duas partes (o caso do reteste: d9c70197).
    ids.leadAntigo = await criarLead(ids.dono, ids.inq, ids.imovel, true);
    await adm().from("leads").update({ accepted_commission_rate: 0.12, accepted_plan: "essential" }).eq("id", ids.leadAntigo);
    await docs(ids.leadAntigo);
    const { data: c } = await adm()
      .from("contratos")
      .insert({ lead_id: ids.leadAntigo, property_id: ids.imovel, tenant_id: ids.inq, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: 120, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.12, comissao_valor: 1536, qtd_ocupantes: 1, garantia: "caucao", status: "ativo", created_at: "2026-10-12T15:00:00Z", assinado_proprietario_em: "2026-10-12T16:00:00Z", assinado_inquilino_em: "2026-10-12T16:05:00Z" })
      .select("id")
      .single();
    ids.contratoAntigo = c!.id as string;
  });

  test.afterAll(async () => {
    await adm().from("cobrancas_fechamento").delete().in("lead_id", [ids.leadAntigo, ids.leadNovo].filter(Boolean));
    await adm().from("contratos").delete().eq("property_id", ids.imovel);
    await adm().from("leads").delete().eq("owner_id", ids.dono);
    await apagarContas([ids.inq, ids.dono]);
  });

  test("1a. 1280 — contrato já assinado: o Resumo diz 'As duas partes assinaram', 'gerado em 12/10' e 'Ver contrato'", async ({ browser }) => {
    test.setTimeout(150_000);
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await gerarAteResumo(page, ids.leadAntigo);
    await expect(page.getByText("TESTE · As duas partes assinaram · Aguardando 1º pagamento")).toBeVisible();
    await expect(page.getByTestId("resumo-contrato")).toContainText("Gerado em 12/10/2026");
    await expect(page.getByTestId("resumo-ver-contrato")).toHaveAttribute("href", `/dashboard/contratos/${ids.contratoAntigo}`);
    await expect(page.getByText(/aguardando assinatura/i)).toHaveCount(0);
    await semRolagemLateral(page);
    await page.screenshot({ path: `${SAIDA}/t210-resumo-assinado-1280.png`, fullPage: true });
    await page.context().close();
  });

  test("1b. 390 — contrato novo: o Resumo diz 'Aguardando assinatura · falta você e o inquilino'", async ({ browser }) => {
    test.setTimeout(150_000);
    ids.leadNovo = await criarLead(ids.dono, ids.inq, ids.imovel, true);
    await adm().from("leads").update({ accepted_commission_rate: 0.12, accepted_plan: "essential" }).eq("id", ids.leadNovo);
    await docs(ids.leadNovo);
    const page = await entrar(browser, dono.email, senha);
    await gerarAteResumo(page, ids.leadNovo);
    await expect(page.getByText("TESTE · Aguardando assinatura · falta você e o inquilino")).toBeVisible();
    await expect(page.getByTestId("resumo-contrato")).not.toContainText("Gerado em");
    await semRolagemLateral(page);
    await page.screenshot({ path: `${SAIDA}/t210-resumo-novo-390.png`, fullPage: true });
    const { data } = await adm().from("contratos").select("id").eq("lead_id", ids.leadNovo).single();
    ids.contratoNovo = data!.id as string;
    await page.context().close();
  });

  test("2. inquilino: 'Contratos' com 'Assinar agora' e o número no menu; Locações só com o assinado", async ({ browser }) => {
    test.setTimeout(120_000);
    const page = await entrar(browser, inq.email, senha);
    for (const largura of [390, 1280]) {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await abrir(page, "/dashboard/contratos");
      const cartoes = page.getByTestId("contrato-inquilino");
      await expect(cartoes).toHaveCount(2, { timeout: 20_000 });
      await expect(page.locator('[data-testid="contrato-inquilino"][data-chave="aguardando_assinatura"]').getByTestId("contrato-inquilino-assinar")).toBeVisible();
      await expect(page.locator('[data-testid="contrato-inquilino"][data-chave="assinado"]').getByTestId("contrato-inquilino-estado")).toHaveText("As duas partes assinaram · Aguardando 1º pagamento");
      await expect(page.locator('[data-testid="contrato-inquilino"][data-chave="assinado"]').getByTestId("contrato-inquilino-locacao")).toBeVisible();
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t210-contratos-inquilino-${largura}.png`, fullPage: true });
      await abrir(page, "/dashboard/locacoes");
      await expect(page.getByTestId("locacao-titulo")).toHaveCount(1, { timeout: 20_000 });
    }
    // O número no menu "Contratos" (falta a assinatura dele em 1 contrato).
    await page.setViewportSize({ width: 1280, height: 900 });
    await abrir(page, "/dashboard");
    const menu = page.getByTestId("menu-cascata").first();
    await menu.getByRole("button", { name: "Minha moradia" }).click().catch(() => {});
    await expect(menu.getByRole("link", { name: /^Contratos/ })).toContainText("1", { timeout: 20_000 });
    await page.context().close();
  });

  test("3. 1º pagamento confirmado → 'Locação ativa' nos dois lados", async ({ browser }) => {
    test.setTimeout(120_000);
    await tornarContratoVigente(ids.contratoNovo, ids.dono, 3200);
    const pi = await entrar(browser, inq.email, senha);
    await abrir(pi, "/dashboard/contratos");
    await expect(pi.locator('[data-testid="contrato-inquilino"][data-chave="locacao_ativa"]')).toHaveCount(1, { timeout: 20_000 });
    await pi.context().close();
    const pd = await entrar(browser, dono.email, senha);
    await pd.setViewportSize({ width: 1280, height: 900 });
    await abrir(pd, "/dashboard/contratos");
    await expect(pd.getByTestId("contrato-etapa").first()).toContainText(/Em vigência/, { timeout: 20_000 });
    await pd.context().close();
  });

  test.describe("admin", () => {
    test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
    test.use({ storageState: authFile("admin") });
    test("4. 1280 — 'Nova jornada de teste' cria candidatura pronta; de novo devolve a mesma; o histórico fica", async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 1280, height: 900 });
      await abrir(page, "/admin/dados-de-teste");
      await page.getByTestId("jornada-inquilino").selectOption(ids.inq);
      await page.getByTestId("jornada-anuncio").selectOption(ids.imovel);
      await page.getByTestId("jornada-criar").click();
      await page.getByTestId("jornada-confirmar").click();
      const link = page.getByTestId("jornada-link");
      await expect(link).toBeVisible({ timeout: 20_000 });
      const href1 = await link.getAttribute("href");
      expect(href1).toMatch(/\/dashboard\/fechamento\?c=[0-9a-f-]{36}$/);
      const novo = href1!.split("c=")[1];
      expect([ids.leadAntigo, ids.leadNovo]).not.toContain(novo);
      const { data: lead } = await adm().from("leads").select("status").eq("id", novo).single();
      expect(lead!.status).toBe("accepted");
      expect(((await adm().from("documentos_inquilino").select("tipo").eq("lead_id", novo)).data ?? []).length).toBe(2);
      await page.screenshot({ path: `${SAIDA}/t210-admin-dados-de-teste-1280.png`, fullPage: true });
      // Idempotente: a jornada aberta (sem contrato) volta.
      await page.getByTestId("jornada-criar").click();
      await page.getByTestId("jornada-confirmar").click();
      await expect(page.getByTestId("jornada-ok")).toContainText("Já havia uma jornada aberta", { timeout: 20_000 });
      expect(await page.getByTestId("jornada-link").getAttribute("href")).toBe(href1);
      // O histórico fica: candidatura e contrato antigos continuam.
      expect(((await adm().from("contratos").select("id").eq("id", ids.contratoAntigo)).data ?? []).length).toBe(1);
      await adm().from("documentos_inquilino").delete().eq("lead_id", novo);
      await adm().from("leads").delete().eq("id", novo);
    });
  });
});
