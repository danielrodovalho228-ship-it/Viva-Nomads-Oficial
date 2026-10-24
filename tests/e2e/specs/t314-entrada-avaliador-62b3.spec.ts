import { test, expect, type Browser, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T314 — Correção 62-B3: a porta de entrada do avaliador credenciado (laboratório; VISTORIA_ATIVA continua desligada:
 * o recrutamento funciona sem a chave e nada aparece para dono ou morador).
 *   1. visitante: /parceiros → "É avaliador de imóveis?" → /parceiros/avaliadores (indexável) → "Pedir credenciamento"
 *      leva à entrada com volta para o pedido;
 *   2. conta nova (não parceiro): UM formulário (dados de parceiro + credenciamento) → solicitação "vistoria" e
 *      credenciamento ligados → pendência "verificar identidade" para a pessoa e para o admin (da ativação, E35-B);
 *   3. identidade verificada → admin vê UM pedido em /admin/avaliadores (fora da fila geral de parceiros) → "Aprovar para
 *      teste" ativa o parceiro e o credenciamento numa ação → a pessoa vê "Em teste" → /avaliadores/[numero] abre (noindex);
 *   4. parceiro de limpeza existente pede sem repetir dados.
 * A conta nova é criada pela fixture (o código de entrada do 49 já tem a t-spec própria); aqui confere-se a volta.
 */
test.describe("T314 — porta de entrada do avaliador (62-B3)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  const senha = novaSenha();
  const sufixo = novoSufixo();
  const nova = { email: `aval.nova.t314.${sufixo}@lab.vivanomads.test`, nome: "Nadia Avaliadora", role: "tenant" as const };
  const limpeza = { email: `aval.limpa.t314.${sufixo}@lab.vivanomads.test`, nome: "Lia Limpeza", role: "tenant" as const };
  const ids: Record<string, string> = {};
  let numero = "";

  async function credDe(userId: string) {
    const { data } = await adm().from("avaliadores_credenciamento").select("id, numero_credenciado, status, parceiro_id, solicitacao_id").eq("user_id", userId).maybeSingle();
    return data as { id: string; numero_credenciado: string; status: string; parceiro_id: string | null; solicitacao_id: string | null } | null;
  }
  async function admin(browser: Browser, url: string): Promise<Page> {
    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(url, { waitUntil: "domcontentloaded" });
    return p;
  }
  const semRolagemLateral = async (p: Page) => expect(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

  test.beforeAll(async () => {
    ids.nova = await criarConta(nova, senha);
    ids.limpeza = await criarConta(limpeza, senha);
    const { data, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.limpeza, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: limpeza.nome, slug: `limpeza-t314-${sufixo}`, categorias: ["limpeza"], cidades: ["Uberlândia"] })
      .select("id")
      .single();
    if (error) throw error;
    ids.parcLimpeza = data.id as string;
  });

  test.afterAll(async () => {
    await adm().from("tenant_verifications").delete().eq("tenant_id", ids.nova ?? "");
    await adm().from("parceiro_solicitacoes").delete().eq("user_id", ids.nova ?? "");
    await apagarContas([ids.nova, ids.limpeza]);
  });

  test("1. visitante: /parceiros → bloco do avaliador → recrutamento indexável → o pedido volta depois da entrada", async ({ browser }) => {
    for (const w of [390, 1280]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
      const p = await ctx.newPage();
      await p.goto("/parceiros", { waitUntil: "domcontentloaded" });
      await p.getByRole("link", { name: "Ser avaliador credenciado" }).click();
      await expect(p).toHaveURL(/\/parceiros\/avaliadores$/);
      await expect(p.getByTestId("recrutamento-avaliador")).toBeVisible();
      await expect(p.getByTestId("recrutamento-requisitos")).toContainText("Identidade verificada");
      await expect(p.getByTestId("recrutamento-pagamento")).not.toContainText(/R\$\s*\d/);
      await expect(p.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
      await expect(p.locator("body")).not.toContainText(/inspe[cç][aã]o|per[ií]cia|engenharia/i);
      await semRolagemLateral(p);
      await p.screenshot({ path: `tests/laboratorio/saida/t314-recrutamento-${w}.png`, fullPage: true });
      if (w === 390) {
        await p.getByTestId("pedir-credenciamento").click();
        await expect(p).toHaveURL(/redirect=%2Fdashboard%2Fparceiro%2Favaliacao/, { timeout: 20_000 });
      }
      await ctx.close();
    }
    // /avaliadores sem número leva ao recrutamento (não 404).
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto("/avaliadores", { waitUntil: "domcontentloaded" });
    await expect(p).toHaveURL(/\/parceiros\/avaliadores$/);
    await ctx.close();
  });

  test("2. conta nova: um formulário só, solicitação + credenciamento ligados, pendência de identidade", async ({ browser }) => {
    const p = await entrar(browser, nova.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
    const form = p.getByTestId("credenciamento-form");
    await expect(form.getByTestId("credenciamento-dados-parceiro")).toBeVisible();
    await expect(form.getByTestId("credenciamento-pendencia")).toContainText("verificar a sua identidade");
    await form.getByLabel(/Nome público/).fill(nova.nome);
    await form.getByLabel("Tipo de pessoa").selectOption("pf");
    await form.getByLabel("CPF ou CNPJ").fill(cpfAleatorio());
    await form.getByLabel("Cidade onde vai avaliar").fill("Uberlândia");
    await form.getByLabel(/Portfólio ou referência/).fill("https://portfolio.lab.vivanomads.test/nadia");
    await form.getByLabel(/Li e aceito o código de conduta/).check();
    await semRolagemLateral(p);
    await p.screenshot({ path: "tests/laboratorio/saida/t314-pedido-unico-390.png", fullPage: true });
    await form.getByTestId("credenciamento-enviar").click();
    await expect.poll(async () => (await credDe(ids.nova))?.numero_credenciado ?? "", { timeout: 20_000 }).toMatch(/^UDI-\d{3}$/);
    const c = (await credDe(ids.nova))!;
    numero = c.numero_credenciado;
    expect(c.status).toBe("solicitado");
    expect(c.parceiro_id).toBeNull();
    const { data: sol } = await adm().from("parceiro_solicitacoes").select("categorias, status").eq("id", c.solicitacao_id!).single();
    expect(sol).toMatchObject({ categorias: ["vistoria"], status: "pendente" });
    await p.reload();
    await expect(p.getByTestId("credenciamento-situacao")).toHaveAttribute("data-status", "solicitado");
    await expect(p.getByTestId("credenciamento-pendencia")).toBeVisible();
    await p.context().close();

    // Admin: UM pedido com os dados juntos e a pendência de identidade (E35-B: ela é da ATIVAÇÃO; a aprovação para
    // teste não espera por ela — coberto no t380).
    const a = await admin(browser, "/admin/avaliadores");
    const item = a.locator(`[data-testid="credenciamento-item"][data-numero="${numero}"]`);
    await expect(item).toHaveCount(1);
    await expect(item.getByTestId("credenciamento-dados-parceiro")).toContainText("Ainda não é parceiro");
    await expect(item.getByTestId("credenciamento-pendencia")).toContainText("Na ativação");
    expect((await credDe(ids.nova))!.status).toBe("solicitado");
    // A fila geral de parceiros não mostra o pedido do avaliador.
    await a.goto("/admin/parceiros?aba=pendentes", { waitUntil: "domcontentloaded" });
    await expect(a.getByText(nova.email)).toHaveCount(0);
    await a.context().close();
  });

  test("3. identidade verificada → uma só aprovação → 'Em teste' → página do avaliador (noindex)", async ({ browser }) => {
    await adm().from("tenant_verifications").insert({ tenant_id: ids.nova, caf_result: { identity: true, document: true, liveness: true, light: "green", simulado: true }, traffic_light: "green", valid_until: new Date(Date.now() + 365 * 86_400_000).toISOString() });
    const a = await admin(browser, "/admin/avaliadores");
    const item = a.locator(`[data-testid="credenciamento-item"][data-numero="${numero}"]`);
    await expect(item.getByTestId("credenciamento-pendencia")).toHaveCount(0);
    await item.getByTestId("decidir-em_teste").getByRole("button", { name: "Aprovar para teste" }).click();
    await expect.poll(async () => (await credDe(ids.nova))?.status, { timeout: 20_000 }).toBe("em_teste");
    const c = (await credDe(ids.nova))!;
    expect(c.parceiro_id).not.toBeNull();
    const { data: parc } = await adm().from("parceiros").select("categorias, user_id").eq("id", c.parceiro_id!).single();
    expect(parc).toMatchObject({ categorias: ["vistoria"], user_id: ids.nova });
    const { data: sol } = await adm().from("parceiro_solicitacoes").select("status").eq("id", c.solicitacao_id!).single();
    expect(sol!.status).toBe("ativada");
    await a.context().close();

    const p = await entrar(browser, nova.email, senha);
    await p.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("credenciamento-situacao")).toHaveAttribute("data-status", "em_teste");
    await expect(p.getByTestId("credenciamento-situacao")).toContainText("Em teste");
    await p.goto(`/avaliadores/${numero}`, { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("avaliador-numero")).toHaveText(numero);
    await expect(p.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(1);
    await p.context().close();
  });

  test("4. parceiro de limpeza existente pede o credenciamento sem repetir dados", async ({ browser }) => {
    const p = await entrar(browser, limpeza.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
    const form = p.getByTestId("credenciamento-form");
    await expect(form.getByTestId("credenciamento-dados-parceiro")).toHaveCount(0);
    await form.getByLabel("Cidade onde vai avaliar").fill("Uberlândia");
    await form.getByLabel(/Portfólio ou referência/).fill("https://portfolio.lab.vivanomads.test/lia");
    await form.getByLabel(/Li e aceito o código de conduta/).check();
    await semRolagemLateral(p);
    await p.screenshot({ path: "tests/laboratorio/saida/t314-parceiro-existente-1280.png", fullPage: true });
    await form.getByTestId("credenciamento-enviar").click();
    await expect.poll(async () => (await credDe(ids.limpeza))?.parceiro_id ?? null, { timeout: 20_000 }).toBe(ids.parcLimpeza);
    expect((await credDe(ids.limpeza))!.solicitacao_id).toBeNull();
    // Nenhuma solicitação nova de parceiro.
    expect(((await adm().from("parceiro_solicitacoes").select("id").eq("user_id", ids.limpeza)).data ?? []).length).toBe(0);
    await p.context().close();
  });
});
