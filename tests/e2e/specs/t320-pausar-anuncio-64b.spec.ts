import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, definirPlano, entrar, novaSenha, novoSufixo, statusDoImovel, aceitarTermoIaSePreciso } from "../fixtures/laboratorio";
import { aceiteParaRascunho } from "../../../src/lib/anuncio/aceite-ia-rascunho";

/**
 * T320 — 64-B: pausar e reativar anúncio pelo dono, limite do plano coerente e aceite de IA que não some.
 * Conta de teste no Gratuito (limite 1) com 4 anúncios publicados (como o proprietario1) e 1 rascunho pronto.
 *   1. publicar o rascunho → "pause 4"; o painel mostra "4 publicados — seu plano permite 1";
 *   2. pausar os 4 pelo selo do cartão (a confirmação lista o que continua) → publicar o rascunho → publicado;
 *   3. reativar um → recusado com "pause 1"; pausado por padrão mínimo não tem Reativar (mostra o caminho);
 *   4. a página pública do pausado diz "Este anúncio está pausado" (sem 404, sem preço);
 *   5. o aceite de IA volta com o rascunho ao ir e voltar na Revisar e cai ao editar a descrição.
 */
const SAIDA = "tests/laboratorio/saida";

test.describe("T320 — pausar anúncio, limite do plano e aceite de IA (64-B)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  const senha = novaSenha();
  const sufixo = novoSufixo();
  const dono = { email: `dono.t320.${sufixo}@lab.vivanomads.test`, nome: "Paulo Pausa", role: "owner" as const };
  const ids: Record<string, string> = {};
  const ativos: string[] = [];

  const motivo = async (id: string) => (await adm().from("properties").select("pausa_motivo").eq("id", id).single()).data?.pausa_motivo ?? null;
  const cartaoDe = (p: Page, status: string) => p.locator(`[data-testid="estado-anuncio"][data-status="${status}"]`);

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await definirPlano(ids.dono, null); // Gratuito: 1 publicado
    for (let i = 1; i <= 4; i++) ativos.push(await criarImovelPronto(ids.dono, `Publicado ${i} t320 ${sufixo}`, { ativo: true }));
    ids.rascunho = await criarImovelPronto(ids.dono, `Rascunho t320 ${sufixo}`);
  });

  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("1. publicar acima do limite diz quantos pausar; o painel mostra publicados x limite", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
    const bloco = p.getByTestId("bloco-limite");
    await expect(bloco).toHaveAttribute("data-ativos", "4");
    await expect(bloco).toContainText("4 publicados — seu plano permite 1");
    await expect(bloco).toContainText("pause 4 anúncios");
    await p.screenshot({ path: `${SAIDA}/t320-limite-390.png`, fullPage: true });
    await p.goto(`/dashboard/imoveis/${ids.rascunho}/editar`, { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("prontidao").locator("..")).toContainText("pause 4 anúncios", { timeout: 20_000 });
    expect(await statusDoImovel(ids.rascunho)).toBe("draft");
    await p.context().close();
  });

  test("2. pausar os 4 pelo selo (a confirmação lista o que continua) e publicar o rascunho", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
    for (let n = 4; n >= 1; n--) {
      await expect(cartaoDe(p, "active")).toHaveCount(n, { timeout: 20_000 });
      await cartaoDe(p, "active").first().click();
      await p.getByTestId("pausar-anuncio").click();
      await expect(p.getByTestId("confirmar-pausa-painel")).toContainText("sai da busca");
      if (n === 4) await p.screenshot({ path: `${SAIDA}/t320-confirmar-pausa-1280.png`, fullPage: true });
      await p.getByTestId("confirmar-pausa").click();
      await expect(cartaoDe(p, "active")).toHaveCount(n - 1, { timeout: 20_000 });
    }
    for (const id of ativos) {
      expect(await statusDoImovel(id)).toBe("paused");
      expect(await motivo(id)).toBe("dono");
    }
    await p.goto(`/dashboard/imoveis/${ids.rascunho}/editar`, { waitUntil: "domcontentloaded" });
    await aceitarTermoIaSePreciso(p);
    await p.getByRole("button", { name: "Publicar", exact: true }).click();
    await expect.poll(() => statusDoImovel(ids.rascunho), { timeout: 30_000 }).toBe("active");
    await p.context().close();
  });

  test("3. reativar acima do limite é recusado com 'pause 1'; pausa da Viva não tem Reativar", async ({ browser }) => {
    // Um dos pausados passa a ser pausa do padrão mínimo (a Viva).
    await adm().from("properties").update({ pausa_motivo: "conforto" }).eq("id", ativos[3]);
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
    const doDono = p.locator('[data-testid="estado-anuncio"][data-status="paused"][data-motivo="dono"]');
    await expect(doDono).toHaveCount(3, { timeout: 20_000 });
    await doDono.first().click();
    await p.getByTestId("reativar-anuncio").click();
    await expect(p.getByTestId("reativar-faltas")).toContainText("pause 1 anúncio", { timeout: 20_000 });
    await expect(p.getByTestId("reativar-faltas").getByRole("link").first()).toHaveAttribute("href", "/dashboard/imoveis");
    for (const id of ativos.slice(0, 3)) expect(await statusDoImovel(id)).toBe("paused");
    // Pausa da Viva: o motivo e o caminho, sem menu.
    const daViva = p.locator('[data-testid="estado-anuncio"][data-motivo="conforto"]');
    await expect(daViva).toHaveCount(1);
    expect(await daViva.evaluate((el) => el.tagName)).toBe("SPAN");
    await expect(p.getByTestId("pausa-viva")).toContainText("Confirme o padrão mínimo");
    await p.screenshot({ path: `${SAIDA}/t320-reativar-recusado-390.png`, fullPage: true });
    await p.context().close();
  });

  test("4. a página pública do anúncio pausado diz que está pausado (sem 404 e sem preço)", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    const r = await p.goto(`/imoveis/${ativos[0]}`, { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBe(200);
    await expect(p.getByTestId("anuncio-pausado")).toContainText("Este anúncio está pausado");
    await expect(p.getByTestId("anuncio-pausado")).not.toContainText("R$");
    await p.screenshot({ path: `${SAIDA}/t320-publico-pausado-390.png`, fullPage: true });
    // Rascunho continua 404.
    const { data, error } = await adm().from("properties").insert({ owner_id: ids.dono, title: `Rascunho invisível t320 ${sufixo}`, city: "Uberlândia", status: "draft" }).select("id").single();
    // Sem o id, o motivo do banco aparece no relatório (antes: "Cannot read properties of null").
    if (error || !data) throw new Error(`rascunho de teste não foi criado: ${error?.message ?? "sem linha"}`);
    const r2 = await p.goto(`/imoveis/${data.id}`, { waitUntil: "domcontentloaded" });
    expect(r2?.status()).toBe(404);
    await ctx.close();
  });

  test("5. o aceite de IA volta com o rascunho e cai ao editar a descrição", async ({ browser }) => {
    // L2-B item 23: o 64-B vale para quem ainda não aceitou o termo no servidor; os testes anteriores publicaram (e aceitaram).
    await adm().from("termo_ia_aceites").delete().eq("user_id", ids.dono);
    const titulo = `Aceite t320 ${sufixo}`;
    const descricao = "Studio mobiliado no Centro, com home office, internet rápida e cozinha completa. Pronto para morar.";
    const { data, error } = await adm()
      .from("properties")
      .insert({
        owner_id: ids.dono,
        title: titulo,
        city: "Uberlândia",
        status: "draft",
        draft_data: { title: titulo, description: descricao, monthlyPrice: "3200", city: "Uberlândia", step: 5, ordemEtapas: 4, etapaMax: 5, aceiteIa: aceiteParaRascunho(true, titulo, descricao) },
      })
      .select("id")
      .single();
    if (error) throw error;
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    const caixa = () => p.getByTestId("aceite-ia").getByRole("checkbox");
    await p.goto(`/dashboard/imoveis/novo?draft=${data.id}&etapa=revisao`, { waitUntil: "domcontentloaded" });
    await expect(caixa()).toBeChecked({ timeout: 20_000 });
    // Ir a outra etapa e voltar: o aceite continua.
    await p.goto(`/dashboard/imoveis/novo?draft=${data.id}&etapa=endereco`, { waitUntil: "domcontentloaded" });
    await p.goto(`/dashboard/imoveis/novo?draft=${data.id}&etapa=revisao`, { waitUntil: "domcontentloaded" });
    await expect(caixa()).toBeChecked({ timeout: 20_000 });
    // Editar a descrição (passo "Título e descrição" dos 10): o aceite cai (e o rascunho salvo não o leva mais).
    await p.goto(`/dashboard/imoveis/novo?draft=${data.id}&etapa=descricao`, { waitUntil: "domcontentloaded" });
    await p.getByTestId("cadastro-descricao").fill(`${descricao} Varanda com vista.`);
    await expect.poll(async () => JSON.stringify((await adm().from("properties").select("draft_data").eq("id", data.id).single()).data?.draft_data ?? {}), { timeout: 20_000 }).toContain("Varanda com vista.");
    await p.goto(`/dashboard/imoveis/novo?draft=${data.id}&etapa=revisao`, { waitUntil: "domcontentloaded" });
    await expect(caixa()).not.toBeChecked({ timeout: 20_000 });
    await p.context().close();
  });
});
