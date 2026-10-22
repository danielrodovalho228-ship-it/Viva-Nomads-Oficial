import { test, expect, type Page } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import {
  NO_LABORATORIO,
  TELEFONE_LAB,
  adm,
  apagarContas,
  cpfAleatorio,
  criarConta,
  criarImovelPronto,
  entrar,
  gravarMensagem,
  novaSenha,
  novoSufixo,
} from "../fixtures/laboratorio";

/*
  T272 — Prompt 43 (perfil, calendários, fluxos, conta única, onboarding e Anunciar em 6 passos), a 390 e 1280 px:
  1. Conta com os 3 papéis: "Seus papéis" com os 3 ativos, Conta em 4 grupos, nenhum seletor de modo; a barra do
     celular segue o contexto da tela (parceiro, proprietário, morador) sem segundo login.
  2. Conta só morador: convites "Anunciar um imóvel" e "Quero ser parceiro"; checklist de morador no Início; nada de
     proprietário ou parceiro além dos convites.
  3. Checklist some ao ativar: o dono com anúncio no ar não vê o checklist de proprietário.
  4. Mensagens: a conversa abre com o contexto no topo (tipo e imóvel).
  5. Anunciar em 6 passos: um rascunho das 5 etapas reabre sem perder campo (antes = depois no banco) e, sem a
     declaração das câmeras, não publica.
  6. "Falar com a Viva" nas telas de decisão; perfil público sem CPF, telefone nem e-mail.
  7. Calendários: disponibilidade do imóvel e agenda do parceiro com o MESMO componente.
*/
const SAIDA = "tests/laboratorio/saida";

async function abas(page: Page): Promise<string[]> {
  const barra = page.locator('nav[aria-label="Navegação principal"]');
  await expect(barra).toBeVisible();
  return barra.getByRole("link").evaluateAll((els) => els.map((e) => (e.textContent ?? "").trim()));
}

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

test.describe("T272 — conta única e fluxos do Prompt 43", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  const senha = novaSenha();
  const sufixo = novoSufixo();
  const tres = { email: `tres.t272.${sufixo}@lab.vivanomads.test`, nome: "Tereza Tres Papeis", role: "owner" as const };
  const morador = { email: `morador.t272.${sufixo}@lab.vivanomads.test`, nome: "Mauro Morador Prado", role: "tenant" as const };
  const ids: Record<string, string | undefined> = {};
  const TITULO = `Studio T272 ${sufixo}`;

  test.beforeAll(async () => {
    ids.tres = await criarConta(tres, senha);
    ids.morador = await criarConta(morador, senha);
    ids.imovel = await criarImovelPronto(ids.tres, TITULO, { ativo: true });
    const { error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.tres, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: "Tereza Servicos", slug: `tereza-t272-${sufixo}`.toLowerCase() });
    if (error) throw error;
    await gravarMensagem(ids.morador, ids.tres, ids.imovel, "Olá! O studio está livre em dezembro?", conversationId(ids.morador, ids.tres, ids.imovel));
    // Rascunho da ordem ANTIGA (5 etapas, parado em "O que encontramos"), sem a declaração das câmeras.
    const { data, error: e2 } = await adm()
      .from("properties")
      .insert({
        owner_id: ids.tres, title: "Rascunho T272 seis passos", description: "Rascunho do laboratório para conferir os 6 passos do Anunciar.",
        property_type: "Apartamento", address: "Centro", city: "Uberlândia", state: "MG", bedrooms: 2, bathrooms: 1, area_m2: 41,
        min_period_days: 30, max_period_days: 180, monthly_price: 3100, status: "draft",
        draft_data: {
          ordemEtapas: 3, step: 2, etapaMax: 3, street: "Rua do Laboratório", numero: "72", neighborhood: "Centro", city: "Uberlândia",
          bedrooms: "2", bathrooms: "1", maxGuests: "3", areaM2: "41", title: "Rascunho T272 seis passos",
          description: "Rascunho do laboratório para conferir os 6 passos do Anunciar.", monthlyPrice: "3100",
          garantias: { caucao_avista: true }, amenityKeys: { ar_condicionado: true },
        },
      })
      .select("id")
      .single();
    if (e2) throw e2;
    ids.rascunho = data.id as string;
  });

  test.afterAll(async () => {
    if (ids.imovel) await adm().from("messages").delete().eq("property_id", ids.imovel);
    if (ids.tres) await adm().from("parceiros").delete().eq("user_id", ids.tres);
    await apagarContas([ids.tres, ids.morador]);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura}px — conta com 3 papéis: Seus papéis, 4 grupos, sem seletor de modo`, async ({ browser }) => {
      const page = await entrar(browser, tres.email, senha);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto("/dashboard/conta", { waitUntil: "domcontentloaded" });
      const papeis = page.getByTestId("seus-papeis").locator("visible=true").first();
      await expect(papeis).toBeVisible({ timeout: 25_000 });
      for (const p of ["morador", "proprietario", "parceiro"]) await expect(papeis.locator(`[data-papel="${p}"]`)).toHaveAttribute("data-ativo", "1");
      await expect(page.getByRole("radiogroup", { name: /modo/i })).toHaveCount(0);
      await expect(page.getByText(/Proprietário \| Inquilino/)).toHaveCount(0);
      if (largura === 390) {
        const grupos = await page.getByTestId("conta-grupo").evaluateAll((els) => els.map((e) => e.getAttribute("data-grupo")));
        for (const g of ["Conta", "Notificações", "Privacidade e segurança", "Pagamentos"]) expect(grupos).toContain(g);
        // A barra segue o contexto da tela, sem troca manual nem segundo login.
        await page.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
        await expect(async () => expect(await abas(page)).toContain("Agenda")).toPass({ timeout: 25_000 });
        await page.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
        await expect(async () => expect(await abas(page)).toContain("Anúncios")).toPass({ timeout: 25_000 });
        await page.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
        await expect(async () => expect(await abas(page)).toContain("Estadias")).toPass({ timeout: 25_000 });
        await expect(page).toHaveURL(/\/dashboard\/locacoes/);
      } else {
        for (const g of ["conta", "notificacoes", "confianca", "pagamentos"]) await expect(page.locator(`#${g}`)).toHaveCount(1);
        await expect(page.getByTestId("conta-pagamentos")).toContainText("A Viva não recebe esse valor");
      }
      // Início: as decisões e os blocos por papel, sem o checklist de proprietário (já tem anúncio no ar).
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 25_000 });
      await expect(page.locator('[data-testid="checklist-ativacao"][data-papel="proprietario"]')).toHaveCount(0);
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t272-tres-papeis-${largura}.png`, fullPage: false });
      await page.context().close();
    });

    test(`${largura}px — conta só morador: convites, checklist e nada de dono ou parceiro`, async ({ browser }) => {
      const page = await entrar(browser, morador.email, senha);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      const lista = page.locator('[data-testid="checklist-ativacao"][data-papel="morador"]');
      await expect(lista).toBeVisible({ timeout: 25_000 });
      await expect(lista.locator('[data-item="pedido"]')).toContainText("Pedido não é contrato");
      await expect(page.locator('[data-testid="checklist-ativacao"][data-papel="proprietario"], [data-testid="checklist-ativacao"][data-papel="parceiro"]')).toHaveCount(0);
      await expect(page.getByTestId("inicio-proprietario")).toHaveCount(0);
      await page.screenshot({ path: `${SAIDA}/t272-morador-inicio-${largura}.png`, fullPage: false });

      await page.goto("/dashboard/conta", { waitUntil: "domcontentloaded" });
      const papeis = page.getByTestId("seus-papeis").locator("visible=true").first();
      await expect(papeis).toBeVisible({ timeout: 25_000 });
      await expect(papeis.locator('[data-papel="proprietario"]')).toHaveAttribute("data-ativo", "0");
      await expect(papeis.getByRole("link", { name: "Anunciar um imóvel" })).toBeVisible();
      await expect(papeis.getByRole("link", { name: "Quero ser parceiro" })).toBeVisible();

      // Mensagens: a conversa abre com o contexto no topo.
      await page.goto("/dashboard/mensagens", { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: new RegExp(TITULO) }).first().click({ timeout: 25_000 });
      const ctx = page.getByTestId("conversa-contexto").locator("visible=true").first();
      await expect(ctx).toBeVisible({ timeout: 15_000 });
      await expect(ctx).toContainText(TITULO);
      await expect(ctx.getByTestId("conversa-contexto-tipo")).toBeVisible();
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t272-mensagens-contexto-${largura}.png`, fullPage: false });

      // "Falar com a Viva" nas telas de decisão do morador (sempre no mesmo lugar, com a promessa de atendimento).
      for (const rota of ["/dashboard/pedidos", "/dashboard/verificacao", "/dashboard/fechamento"]) {
        await page.goto(rota, { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("falar-com-a-viva").first()).toBeVisible({ timeout: 25_000 });
      }
      await page.context().close();
    });

    test(`${largura}px — Anunciar em 6 passos: rascunho antigo sem perder campo; sem a declaração das câmeras não publica`, async ({ browser }) => {
      const { data: antes } = await adm().from("properties").select("draft_data").eq("id", ids.rascunho!).single();
      const page = await entrar(browser, tres.email, senha);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto(`/dashboard/imoveis/novo?draft=${ids.rascunho}`, { waitUntil: "domcontentloaded" });
      // "O que encontramos" das 5 etapas reabre em "Tipo e quartos" (passo 2 de 6), com os campos de antes.
      await expect(page.getByRole("heading", { name: "Tipo e quartos" })).toBeVisible({ timeout: 30_000 });
      if (largura === 390) await expect(page.getByTestId("etapas-celular")).toHaveText(/^Passo 2 de 6 — Tipo e quartos/);
      else await expect(page.getByTestId("etapas-cadastro").getByRole("button")).toHaveCount(6);
      await expect(page.getByTestId("cadastro-banheiros")).toHaveValue("1");
      await expect(page.getByTestId("cadastro-capacidade")).toHaveValue("3");
      await expect(page.getByTestId("cadastro-area")).toHaveValue("41");
      await page.screenshot({ path: `${SAIDA}/t272-anunciar-passo2-${largura}.png`, fullPage: false });

      await page.goto(`/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=comodidades`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Comodidades e segurança" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("cadastro-titulo")).toHaveValue("Rascunho T272 seis passos");
      const seguranca = page.getByTestId("seguranca-imovel");
      await expect(seguranca.locator('[data-grupo="seguranca"] [data-comodidade]')).toHaveCount(2);
      await expect(seguranca.getByTestId("declaracao-sem-cameras")).toHaveAttribute("aria-checked", "false");
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t272-anunciar-passo4-${largura}.png`, fullPage: true });

      // Revisar: sem a declaração das câmeras, a privacidade fica pendente e o anúncio não publica.
      await page.goto(`/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=revisar`, { waitUntil: "domcontentloaded" });
      const revisar = page.getByTestId("etapa-revisar");
      await expect(revisar).toBeVisible({ timeout: 30_000 });
      await expect(revisar.getByTestId("checklist-item-privacidade")).toHaveAttribute("data-ok", "0");
      await expect(page.getByTestId("publicar-anuncio")).toBeDisabled();

      // Nenhum campo salvo antes se perdeu: o rascunho no banco mantém tudo (só a etapa muda de ordem).
      await page.waitForTimeout(3_000);
      const { data: depois } = await adm().from("properties").select("draft_data").eq("id", ids.rascunho!).single();
      const a = antes!.draft_data as Record<string, unknown>;
      const d = depois!.draft_data as Record<string, unknown>;
      for (const k of ["street", "numero", "neighborhood", "city", "bathrooms", "maxGuests", "areaM2", "title", "description", "monthlyPrice"]) expect(d[k], k).toEqual(a[k]);
      expect(d.garantias).toMatchObject({ caucao_avista: true });
      expect(d.amenityKeys).toMatchObject({ ar_condicionado: true });
      await page.context().close();
    });
  }

  test("perfil público sem CPF, telefone nem e-mail; calendários com o mesmo componente", async ({ browser }) => {
    const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const p = await anon.newPage();
    const r = await p.goto(`/proprietario/${ids.tres}`, { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBe(200);
    const html = await p.content();
    const { data: perfil } = await adm().from("profiles").select("cpf").eq("id", ids.tres!).single();
    expect(html).not.toContain(tres.email);
    expect(html).not.toContain(TELEFONE_LAB.replace(/\D/g, "").slice(-8));
    expect(html).not.toContain(TELEFONE_LAB);
    if (perfil?.cpf) expect(html).not.toContain(String(perfil.cpf).replace(/\D/g, ""));
    await anon.close();

    const page = await entrar(browser, tres.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/dashboard/imoveis/${ids.imovel}/editar`, { waitUntil: "domcontentloaded" });
    await expect(async () => {
      const cal = page.locator('[data-testid="calendario-mes"][data-tipo="disponibilidade"]');
      if ((await cal.count()) === 0) await page.getByText(/Disponibilidade|Calendário/).first().click({ timeout: 2_000 }).catch(() => {});
      await expect(cal.first()).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    await page.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-testid="calendario-mes"][data-tipo="agenda"]').first()).toBeVisible({ timeout: 25_000 });
    await expect(page.getByTestId("calendario-legenda").first()).toBeVisible();
    await page.screenshot({ path: `${SAIDA}/t272-agenda-parceiro-1280.png`, fullPage: false });
    await page.context().close();
  });
});
