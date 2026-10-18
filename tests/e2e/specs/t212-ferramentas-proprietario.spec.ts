import { test, expect, type Browser, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T212 — Prompt 27, Ferramentas do proprietário (QA do Muse, 18/10). 390 e 1280 px.
   1. Simulador = Calculadora de ROI com os números do Muse (R$ 3.000, 10 meses, sem condomínio, contas R$ 400 à parte,
      R$ 25.000 com 10% de reposição, 12%): os dois dão R$ 23.900 (antes 26.400 × 23.900).
   2. Sem QuintoAndar; canais = Viva, Airbnb e Contrato tradicional (12+ meses).
   3. Cenários Conservador / Realista / Otimista nas duas telas.
   4. Acumulado: a barra do Ano 1 (−R$ 1.100) tem altura > 0 abaixo da linha do zero, com o rótulo "−R$ 1.100".
   5. Negociação no editor do anúncio publicado: itens + mínimo privado + limpezas; o mínimo nunca aparece na página
      pública nem na API.
   6. Taxa de serviço: "12% sobre o valor mensal × meses (R$ 3.200 × 4 = R$ 12.800) = R$ 1.536" com consumo, limpeza e pet.
   7. O inquilino acha a proposta sem e-mail: Visão geral ("vence em N dias"), menu "Propostas" com o número, lista,
      Notificações e o cartão na conversa.
   8. Admin → Dados de teste: "Semear carteira de teste" (3 imóveis ativos, 2 contratos encerrados + 1 ativo),
      idempotente, abre a Análise da carteira; "Limpar carteira de teste" apaga só ela.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: Record<string, string | undefined> = {};
const dono = { email: `dono.t212.${sufixo}@lab.vivanomads.test`, nome: "Dalila Ferramentas Sobrenome", role: "owner" as const };
const inq = { email: `inq.t212.${sufixo}@lab.vivanomads.test`, nome: "Irene Proposta Sobrenome", role: "tenant" as const };

async function abrir(page: Page, rota: string) {
  await page.goto(rota, { waitUntil: "domcontentloaded" });
  await page.locator("main").first().waitFor();
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

async function numero(page: Page, rotulo: string, valor: number) {
  // O nome acessível do campo leva o prefixo "R$" quando há (ex.: "Valor mensal pretendido R$").
  const esc = rotulo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const campo = page.getByRole("spinbutton", { name: new RegExp(`^${esc}( R\\$)?$`) });
  await campo.fill(String(valor));
  await expect(campo).toHaveValue(String(valor));
}

async function comoDono(browser: Browser, largura: number): Promise<Page> {
  const p = await entrar(browser, dono.email, senha);
  await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  return p;
}

const emDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

test.describe("T212 — ferramentas do proprietário (prompt 27)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio ferramentas ${sufixo}`, { ativo: true, preco: 3200 });
    await adm().from("properties").update({ condo_fee: 300, utilities_mode: "real", prep_fee: 0, limpeza_estadia: null }).eq("id", ids.imovel);
    ids.lead = await criarLead(ids.dono, ids.inq, ids.imovel);
  });

  test.afterAll(async () => {
    if (ids.imovel) {
      await adm().from("messages").delete().eq("property_id", ids.imovel);
      await adm().from("propostas").delete().eq("property_id", ids.imovel);
      await adm().from("property_negociacao_limites").delete().eq("property_id", ids.imovel);
    }
    await apagarContas([ids.inq, ids.dono]);
  });

  for (const largura of [390, 1280]) {
    test(`1–4. ${largura} — Simulador e Calculadora dão o mesmo líquido; canais; cenários; barra negativa`, async ({ browser }) => {
      test.setTimeout(120_000);
      const p = await comoDono(browser, largura);
      // Simulador com os números do Muse.
      await abrir(p, "/dashboard/simulador");
      await numero(p, "Valor mensal pretendido", 3000);
      await numero(p, "Condomínio + IPTU (mês)", 0);
      await numero(p, "Contas de consumo — água, luz, internet (mês)", 400);
      await numero(p, "Investimento na mobília", 25000);
      await numero(p, "Reposição e desgaste da mobília (% do investimento por ano)", 10);
      await expect(p.getByTestId("sim-liquida")).toContainText("23.900");
      await expect(p.getByTestId("sim-taxa-rotulo")).toContainText("Taxa de serviço: 12% sobre o valor mensal × meses (R$ 3.000 × 10 = R$ 30.000) = R$ 3.600");
      const cenSim = p.getByTestId("sim-cenarios").locator("tbody tr td:first-child");
      await expect(cenSim).toHaveText(["Conservador", "Realista", "Otimista"]);
      expect(await p.locator("main").innerText()).not.toMatch(/quinto\s*andar/i);
      await semRolagemLateral(p);
      await p.screenshot({ path: `${SAIDA}/t212-simulador-${largura}.png`, fullPage: true });

      // Calculadora de ROI com os mesmos números.
      await abrir(p, "/dashboard/roi-imovel");
      await numero(p, "Investimento para mobiliar", 25000);
      await numero(p, "Valor mensal MOBILIADO pretendido", 3000);
      await numero(p, "Condomínio + IPTU (mês)", 0);
      await numero(p, "Contas de consumo — água, luz, internet (mês)", 400);
      await numero(p, "Reposição e desgaste da mobília (% do investimento por ano)", 10);
      await numero(p, "Valor mensal VAZIO de referência", 1800);
      await expect(p.getByTestId("roi-liquidos")).toContainText("23.900");
      const main = await p.locator("main").innerText();
      expect(main).not.toMatch(/quinto\s*andar/i);
      await expect(p.getByTestId("roi-canal")).toHaveCount(3);
      await expect(p.getByTestId("roi-canais")).toContainText("Contrato tradicional (12+ meses)");
      await expect(p.getByTestId("roi-cenarios").locator("tbody tr td:first-child")).toHaveText(["Conservador", "Realista", "Otimista"]);

      // Ano 1 do mobiliado: −R$ 1.100, barra com altura e abaixo do zero.
      const barra = p.locator('[data-testid="roi-acumulado-barra"][data-grupo="Ano 1"][data-serie="Mobiliado"]');
      await expect(barra).toHaveAttribute("data-valor", "-1100");
      const zero = await p.getByTestId("roi-acumulado-zero").boundingBox();
      const b = await barra.boundingBox();
      expect(b!.height).toBeGreaterThanOrEqual(4);
      expect(b!.y).toBeGreaterThanOrEqual(zero!.y - 1);
      await expect(p.getByTestId("roi-acumulado")).toContainText("−R$ 1.100");
      await p.getByTestId("roi-acumulado").scrollIntoViewIfNeeded();
      await semRolagemLateral(p);
      await p.screenshot({ path: `${SAIDA}/t212-roi-acumulado-${largura}.png`, fullPage: false });
      await p.context().close();
    });
  }

  test("5. 1280 — negociação no editor do anúncio publicado; o mínimo privado nunca aparece no público", async ({ browser }) => {
    test.setTimeout(120_000);
    const p = await comoDono(browser, 1280);
    await abrir(p, `/dashboard/imoveis/${ids.imovel}/editar`);
    await p.getByRole("button", { name: /Negociação/ }).click();
    const bloco = p.getByTestId("editar-negociacao");
    await bloco.getByTestId("negociar-sim").click();
    await bloco.getByTestId("negociavel-valor_mensal").click();
    await bloco.getByTestId("negociavel-meses").click();
    await bloco.getByLabel("Menor valor mensal que aceito (R$)").fill("2950");
    await bloco.getByLabel("Limpezas por mês que posso incluir").fill("2");
    await bloco.getByRole("button", { name: /^Salvar seção/ }).click();
    await expect
      .poll(async () => (await adm().from("properties").select("negociacao").eq("id", ids.imovel!).single()).data?.negociacao, { timeout: 20_000 })
      .toMatchObject({ aceita: true, itens: ["valor_mensal", "meses"] });
    await expect
      .poll(async () => (await adm().from("property_negociacao_limites").select("valor_minimo, limpezas_max").eq("property_id", ids.imovel!).maybeSingle()).data, { timeout: 20_000 })
      .toMatchObject({ valor_minimo: 2950, limpezas_max: 2 });
    await expect(bloco).toContainText("Aceito negociar: Sim");
    await p.screenshot({ path: `${SAIDA}/t212-negociacao-editor-1280.png`, fullPage: true });
    await p.context().close();
    // H: nem a página pública nem a API mostram o mínimo.
    const anon = await browser.newContext();
    const pa = await anon.newPage();
    await pa.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
    expect(await pa.content()).not.toMatch(/2\.?950/);
    expect(await (await pa.request.get("/api/properties")).text()).not.toMatch(/2\.?950/);
    await anon.close();
  });

  for (const largura of [390, 1280]) {
    test(`6–7. ${largura} — taxa com a base certa; o inquilino acha a proposta sem e-mail`, async ({ browser }) => {
      test.setTimeout(150_000);
      await adm().from("propostas").delete().eq("property_id", ids.imovel!);
      // O dono envia pela tela; o anúncio tem condomínio (fora da base da taxa).
      const d = await comoDono(browser, largura);
      await d.goto(`/dashboard/orcamentos/nova?interessado=${ids.lead}`, { waitUntil: "domcontentloaded" });
      await expect(d.getByTestId("montagem-proposta")).toBeVisible({ timeout: 20_000 });
      await d.getByTestId("proposta-valor").fill("3200");
      await d.getByTestId("proposta-meses").selectOption("4");
      await d.getByTestId("proposta-data").fill(emDias(10));
      await d.getByTestId("proposta-validade").selectOption("7");
      // O total do contrato inclui o condomínio (R$ 300/mês), mas a base da taxa continua R$ 3.200 × 4.
      await expect(d.getByTestId("resumo-total-contrato")).not.toHaveText(/^R\$\s?12\.800$/);
      await expect(d.getByTestId("proposta-taxa-dono")).toContainText("Taxa de serviço: 12% sobre o valor mensal × meses (R$ 3.200 × 4 = R$ 12.800) = R$ 1.536");
      await d.getByTestId("enviar-proposta").click();
      await d.waitForURL(/\/dashboard\/propostas\/[0-9a-f-]{36}$/, { timeout: 20_000 });
      await expect(d.getByTestId("proposta-taxa")).toContainText("(R$ 3.200 × 4 = R$ 12.800) = R$ 1.536");
      await d.screenshot({ path: `${SAIDA}/t212-taxa-proposta-${largura}.png`, fullPage: true });
      await d.context().close();

      const t = await entrar(browser, inq.email, senha);
      await t.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await abrir(t, "/dashboard");
      await expect(t.getByTestId("cartao-proposta-recebida")).toContainText(/Você recebeu uma proposta — vence em \d+ dias/, { timeout: 25_000 });
      await semRolagemLateral(t);
      await t.screenshot({ path: `${SAIDA}/t212-visao-geral-proposta-${largura}.png` });
      await abrir(t, "/dashboard/propostas");
      const item = t.getByTestId("proposta-inquilino").first();
      await expect(item).toContainText("R$ 3.200/mês × 4 meses", { timeout: 25_000 });
      await expect(t.getByTestId("proposta-inquilino-validade").first()).toContainText(/vence em \d+ dias · aguardando a sua resposta/);
      await t.screenshot({ path: `${SAIDA}/t212-lista-propostas-${largura}.png`, fullPage: true });
      await abrir(t, "/dashboard/notificacoes");
      await expect(t.getByTestId("aviso-proposta").first()).toContainText("Você recebeu uma proposta");
      // O número no menu "Propostas".
      if (largura === 1280) {
        const menu = t.locator("aside, nav").filter({ hasText: "Minha moradia" }).first();
        await menu.getByRole("button", { name: "Minha moradia" }).click().catch(() => {});
        await expect(menu.getByRole("link", { name: /^Propostas/ })).toContainText("1", { timeout: 20_000 });
      }
      // O cartão da proposta na conversa.
      await abrir(t, "/dashboard/mensagens");
      await expect(t.getByTestId("cartao-proposta").first()).toBeVisible({ timeout: 25_000 });
      await t.context().close();
    });
  }

  test.describe("admin", () => {
    test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
    test.use({ storageState: authFile("admin") });
    test("8. 1280 — semear a carteira de teste (idempotente) e limpar só ela", async ({ page }) => {
      test.setTimeout(150_000);
      const tag = randomBytes(3).toString("hex");
      const donoT = await criarConta({ email: `dono.cart.${tag}.${sufixo}@lab.vivanomads.test`, nome: "Carla Carteira Sobrenome", role: "owner" }, senha);
      const inqT = await criarConta({ email: `inq.cart.${tag}.${sufixo}@lab.vivanomads.test`, nome: "Ivo Carteira Sobrenome", role: "tenant" }, senha);
      await adm().from("profiles").update({ is_teste: true }).in("id", [donoT, inqT]);
      try {
        await page.setViewportSize({ width: 1280, height: 900 });
        await abrir(page, "/admin/dados-de-teste");
        await page.getByTestId("carteira-proprietario").selectOption(donoT);
        await page.getByTestId("carteira-inquilino").selectOption(inqT);
        await page.getByTestId("carteira-semear").click();
        await page.getByTestId("carteira-confirmar").click();
        await expect(page.getByTestId("carteira-ok")).toContainText("3 imóveis ativos e 3 contratos (3 imóveis e 3 contratos criados agora)", { timeout: 30_000 });
        const { data: props } = await adm().from("properties").select("id, title, status").eq("owner_id", donoT);
        expect((props ?? []).filter((x) => x.status === "active" && /^\[TESTE QA\] Carteira/.test(x.title as string))).toHaveLength(3);
        const { data: cs } = await adm().from("contratos").select("status").in("property_id", (props ?? []).map((x) => x.id as string));
        expect((cs ?? []).map((c) => c.status).sort()).toEqual(["ativo", "concluido", "concluido"]);
        await page.screenshot({ path: `${SAIDA}/t212-carteira-semeada-1280.png`, fullPage: true });
        // Idempotente.
        await page.getByTestId("carteira-semear").click();
        await page.getByTestId("carteira-confirmar").click();
        await expect(page.getByTestId("carteira-ok")).toContainText("(0 imóveis e 0 contratos criados agora)", { timeout: 30_000 });
        // A Análise da carteira abre para o dono de teste.
        const pd = await entrar(page.context().browser()!, `dono.cart.${tag}.${sufixo}@lab.vivanomads.test`, senha);
        await pd.setViewportSize({ width: 1280, height: 900 });
        await abrir(pd, "/dashboard/carteira");
        await expect(pd.getByTestId("carteira-fechada")).toHaveCount(0);
        await pd.screenshot({ path: `${SAIDA}/t212-carteira-analise-1280.png`, fullPage: true });
        await pd.context().close();
        // Limpar apaga só a carteira de teste.
        const outro = await criarImovelPronto(donoT, `Studio que fica ${tag}`, { ativo: true });
        await page.getByTestId("carteira-limpar").click();
        await page.getByTestId("carteira-confirmar").click();
        await expect(page.getByTestId("carteira-ok")).toContainText("Carteira limpa: 3 imóveis e 3 contratos apagados.", { timeout: 30_000 });
        const { data: resto } = await adm().from("properties").select("id").eq("owner_id", donoT);
        expect((resto ?? []).map((x) => x.id)).toEqual([outro]);
      } finally {
        await apagarContas([inqT, donoT]);
      }
    });
  });
});
