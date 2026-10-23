import { test, expect, type Browser, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, liberarLimiteChamados, novaSenha, novoSufixo, statusDoImovel } from "../fixtures/laboratorio";
import { cliqueResponde } from "../fixtures/varredura";

/**
 * T316 — Prompt 51, fase 1: Sair da Viva (laboratório).
 *   1. dono: os 3 cartões com o mesmo peso (390 e 1280) → "Continuar sem responder" (mesma classe de "Continuar") →
 *      pausar → os anúncios saem da busca, o contrato não muda → "Reativar minha conta" no topo do painel em 1 toque;
 *   2. morador: sair com motivo "atendimento" → a ajuda aparece e não bloqueia ("Seguir com a saída", mesma classe) →
 *      a exclusão abre com o texto novo; varredura (f) no botão de confirmação; nenhuma saída exige motivo;
 *   3. regra: mais de 3 saídas pelo mesmo motivo em 30 dias vira Correção sem dono → decisão no /admin → dono e prazo →
 *      fechar só com PR ou ação;
 *   4. denúncia: uma por conta, P1 para pagamento por fora, o anúncio continua publicado; o estado volta a quem denunciou.
 */
test.describe("T316 — Sair da Viva (51 F1)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  const senha = novaSenha();
  const sufixo = novoSufixo();
  const dono = { email: `dono.t315.${sufixo}@lab.vivanomads.test`, nome: "Otávio Saída", role: "owner" as const };
  const morador = { email: `morador.t315.${sufixo}@lab.vivanomads.test`, nome: "Marina Saída", role: "tenant" as const };
  const ids: Record<string, string> = {};
  // Motivo do caso 3 (papel parceiro): pouco provável de já ter saídas reais no laboratório.
  const REGRA = { papel: "parceiro", motivo: "parei_servico" };

  async function admin(browser: Browser, url: string): Promise<Page> {
    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(url, { waitUntil: "domcontentloaded" });
    return p;
  }
  const semRolagemLateral = async (p: Page) => expect(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  const classe = (p: Page, testid: string) => p.getByTestId(testid).getAttribute("class");

  test.beforeAll(async () => {
    await liberarLimiteChamados();
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.comContrato = await criarImovelPronto(ids.dono, `Studio contrato t315 ${sufixo}`, { ativo: true });
    ids.livre = await criarImovelPronto(ids.dono, `Loft livre t315 ${sufixo}`, { ativo: true });
    const lead = await criarLead(ids.dono, ids.morador, ids.comContrato, true);
    const { data, error } = await adm()
      .from("contratos")
      .insert({ lead_id: lead, property_id: ids.comContrato, tenant_id: ids.morador, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: 60, aluguel_mensal: 3000, tamanho_bloco_meses: 2, comissao_percent: 0.12, comissao_valor: 720, qtd_ocupantes: 1 })
      .select("id, status")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
    ids.statusContrato = data.status as string;
    await adm().from("qualidade_correcoes").delete().eq("papel", REGRA.papel).eq("motivo", REGRA.motivo);
  });

  test.afterAll(async () => {
    await adm().from("saidas_motivos").delete().eq("papel", REGRA.papel).eq("motivo", REGRA.motivo).is("user_id", null);
    await adm().from("qualidade_correcoes").delete().eq("papel", REGRA.papel).eq("motivo", REGRA.motivo);
    await adm().from("saidas_motivos").delete().in("user_id", [ids.dono, ids.morador].filter(Boolean));
    await apagarContas([ids.dono, ids.morador]);
  });

  test("1. dono: 3 cartões iguais, saída sem motivo, pausa tira da busca sem mexer no contrato, reativa em 1 toque", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    for (const w of [1280, 390]) {
      await p.setViewportSize({ width: w, height: 900 });
      await p.goto("/dashboard/conta/excluir", { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("saida-cartoes")).toBeVisible();
      const [a, b, c] = await Promise.all(["pausar", "apagar", "encerrar"].map((n) => classe(p, `saida-escolher-${n}`)));
      expect(a).toBe(b);
      expect(b).toBe(c);
      await expect(p.getByTestId("sair-da-viva")).not.toContainText(/todos os (seus )?dados/i);
      await semRolagemLateral(p);
      await p.screenshot({ path: `tests/laboratorio/saida/t316-cartoes-${w}.png`, fullPage: true });
    }

    await p.getByTestId("saida-escolher-pausar").click();
    await expect(p.getByTestId("saida-motivo")).toBeVisible();
    expect(await classe(p, "saida-continuar")).toBe(await classe(p, "saida-sem-responder"));
    await p.getByTestId("saida-sem-responder").click();
    await expect(p.getByTestId("saida-pausar")).toBeVisible({ timeout: 15_000 });
    await p.screenshot({ path: "tests/laboratorio/saida/t316-pausar-390.png", fullPage: true });
    expect(await cliqueResponde(p, p.getByTestId("saida-confirmar-pausa"), "Pausar minha conta")).toEqual([]);
    await expect.poll(async () => (await adm().from("profiles").select("pausada_em").eq("id", ids.dono).single()).data?.pausada_em ?? null, { timeout: 20_000 }).not.toBeNull();

    // Sem motivo: a saída foi registrada só com o nível.
    const { data: saida } = await adm().from("saidas_motivos").select("nivel, motivo").eq("user_id", ids.dono).single();
    expect(saida).toMatchObject({ nivel: "pausar", motivo: null });
    // Anúncios fora da busca; o contrato não mudou.
    expect(await statusDoImovel(ids.livre)).toBe("paused");
    expect(await statusDoImovel(ids.comContrato)).toBe("paused");
    expect((await adm().from("contratos").select("status").eq("id", ids.contrato).single()).data?.status).toBe(ids.statusContrato);
    await p.goto("/buscar?cidade=Uberl%C3%A2ndia", { waitUntil: "domcontentloaded" });
    await expect(p.locator(`a[href*="${ids.livre}"]`)).toHaveCount(0);

    // Topo do painel: reativar em 1 toque.
    await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("conta-pausada")).toBeVisible();
    await p.screenshot({ path: "tests/laboratorio/saida/t316-conta-pausada-390.png" });
    await p.getByTestId("reativar-conta").click();
    await expect(p.getByTestId("conta-pausada")).toHaveCount(0, { timeout: 20_000 });
    expect(await statusDoImovel(ids.livre)).toBe("active");
    expect(await statusDoImovel(ids.comContrato)).toBe("active");
    expect((await adm().from("profiles").select("pausada_em").eq("id", ids.dono).single()).data?.pausada_em).toBeNull();
    await p.context().close();
  });

  test("2. morador: motivo 'atendimento' oferece ajuda sem bloquear; a exclusão abre com o texto novo", async ({ browser }) => {
    const p = await entrar(browser, morador.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto("/dashboard/conta/excluir", { waitUntil: "domcontentloaded" });
    await p.getByTestId("saida-escolher-apagar").click();
    await p.getByTestId("saida-motivo").getByLabel("Problema com atendimento").check();
    await p.getByTestId("saida-continuar").click();
    await expect(p.getByTestId("saida-ajuda")).toBeVisible({ timeout: 15_000 });
    await expect(p.getByTestId("saida-aceitar-ajuda")).toHaveText("Falar com uma pessoa agora");
    expect(await classe(p, "saida-aceitar-ajuda")).toBe(await classe(p, "saida-seguir"));
    await p.screenshot({ path: "tests/laboratorio/saida/t316-ajuda-390.png", fullPage: true });
    await p.getByTestId("saida-seguir").click();
    await expect(p.getByText("apagamos sua conta e seus dados pessoais").first()).toBeVisible();
    await expect(p.locator("main")).not.toContainText(/todos os (seus )?dados|exclus[aã]o [eé] imediata/i);
    expect(await cliqueResponde(p, p.getByRole("button", { name: "Quero excluir minha conta" }), "Quero excluir minha conta")).toEqual([]);
    await expect(p.getByRole("button", { name: "Continuar a exclusão" })).toBeVisible();
    const { data } = await adm().from("saidas_motivos").select("papel, nivel, motivo, ajuda_oferecida, revertida").eq("user_id", ids.morador).single();
    expect(data).toMatchObject({ papel: "morador", nivel: "apagar", motivo: "atendimento", ajuda_oferecida: "falar_com_pessoa", revertida: false });
    await p.context().close();
  });

  test("3. regra dos 3 em 30 dias: a 4ª saída cria a Correção; dono e prazo; fechar exige PR ou ação", async ({ browser }) => {
    const agora = Date.now();
    const linhas = [1, 5, 12, 20].map((d) => ({ papel: REGRA.papel, nivel: "apagar", motivo: REGRA.motivo, criado_em: new Date(agora - d * 86_400_000).toISOString() }));
    const { error } = await adm().from("saidas_motivos").insert(linhas.slice(0, 3));
    if (error) throw error;

    // 3 não basta.
    let a = await admin(browser, "/admin/qualidade");
    const item = () => a.locator(`[data-testid="correcao"][data-papel="${REGRA.papel}"][data-motivo="${REGRA.motivo}"]`);
    await expect(a.getByTestId("qualidade-quebradores").getByTestId("quebrador")).toHaveCount(8);
    await expect(item()).toHaveCount(0);
    await a.context().close();

    await adm().from("saidas_motivos").insert(linhas.slice(3));
    // A leitura do painel (e cada motivo gravado pela tela) abre a Correção; o início do /admin passa a pedir a decisão.
    a = await admin(browser, "/admin/qualidade");
    await expect(item()).toHaveAttribute("data-estado", "sem_dono");
    await a.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(a.getByText(/Corre[çc](ão|ões) de qualidade sem dono ou prazo/)).toBeVisible({ timeout: 15_000 });
    await a.goto("/admin/qualidade", { waitUntil: "domcontentloaded" });
    await expect(item()).toContainText("4 saídas");
    await expect(a.getByTestId("qualidade-decisoes")).toContainText("sem dono ou prazo");
    await a.screenshot({ path: "tests/laboratorio/saida/t316-painel-1280.png", fullPage: true });

    // Fechar antes do dono e do prazo: recusado.
    await item().getByTestId("correcao-fechar").getByLabel("PR ou ação feita").fill("#1234");
    await item().getByTestId("correcao-fechar").getByRole("button", { name: "Fechar a Correção" }).click();
    await expect(item().getByTestId("acao-erro")).toContainText("Defina o dono e o prazo");
    const prazo = new Date(agora + 14 * 86_400_000).toISOString().slice(0, 10);
    await item().getByTestId("correcao-definir").getByLabel("Dono").fill("Equipe de parceiros");
    await item().getByTestId("correcao-definir").getByLabel("Prazo").fill(prazo);
    await item().getByTestId("correcao-definir").getByRole("button", { name: "Salvar dono e prazo" }).click();
    await expect(item()).toHaveAttribute("data-estado", "com_dono", { timeout: 15_000 });
    // Ligação vaga: recusada; com o PR: fechada.
    await item().getByTestId("correcao-fechar").getByLabel("PR ou ação feita").fill("ok");
    await item().getByTestId("correcao-fechar").getByRole("button", { name: "Fechar a Correção" }).click();
    await expect(item().getByTestId("acao-erro")).toContainText("ligue a correção a um PR");
    await item().getByTestId("correcao-fechar").getByLabel("PR ou ação feita").fill("#1234");
    await item().getByTestId("correcao-fechar").getByRole("button", { name: "Fechar a Correção" }).click();
    await expect(item()).toHaveAttribute("data-estado", "fechada", { timeout: 15_000 });

    await a.setViewportSize({ width: 390, height: 844 });
    await a.reload();
    await semRolagemLateral(a);
    await a.screenshot({ path: "tests/laboratorio/saida/t316-painel-390.png", fullPage: true });
    await a.context().close();
  });

  test("4. denúncia: uma por conta, P1 para pagamento por fora, o anúncio continua publicado, o estado volta", async ({ browser }) => {
    const p = await entrar(browser, morador.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto(`/imoveis/${ids.livre}`, { waitUntil: "domcontentloaded" });
    await p.getByTestId("denunciar-anuncio").click();
    const caixa = p.getByTestId("denuncia-anuncio");
    await caixa.getByLabel("Pediu pagamento ou contato fora da Viva").check();
    await caixa.getByLabel(/Quer contar mais/).fill("Pediu Pix direto antes da visita.");
    await p.screenshot({ path: "tests/laboratorio/saida/t316-denuncia-390.png", fullPage: true });
    await caixa.getByTestId("denuncia-enviar").click();
    await expect(caixa.getByTestId("denuncia-resultado")).toContainText("Denúncia recebida", { timeout: 20_000 });
    await expect(caixa.getByTestId("denuncia-estado")).toHaveAttribute("data-estado", "recebida");

    const { data: d } = await adm().from("denuncias_anuncio").select("id, motivo, status, chamado_numero").eq("property_id", ids.livre).eq("user_id", ids.morador).single();
    expect(d).toMatchObject({ motivo: "pagamento_fora", status: "recebida" });
    const { data: ch } = await adm().from("chamados").select("prioridade, contexto_tipo").eq("numero_publico", d!.chamado_numero!).single();
    expect(ch).toMatchObject({ prioridade: "p1", contexto_tipo: "anuncio" });
    expect(await statusDoImovel(ids.livre)).toBe("active");

    // Uma por conta: a 2ª visita mostra o estado, não o formulário.
    await p.reload();
    await p.getByTestId("denunciar-anuncio").click();
    await expect(p.getByTestId("denuncia-estado")).toHaveAttribute("data-estado", "recebida", { timeout: 15_000 });
    await expect(p.getByTestId("denuncia-enviar")).toHaveCount(0);

    // O atendimento muda o estado; quem denunciou vê.
    const a = await admin(browser, "/admin/qualidade#denuncias");
    const linha = a.locator(`[data-testid="denuncia"][data-property="${ids.livre}"]`);
    await expect(linha).toContainText("P1");
    await linha.getByLabel("Estado").selectOption("em_analise");
    await linha.getByRole("button", { name: "Atualizar" }).click();
    await expect(linha.getByTestId("acao-ok")).toBeVisible({ timeout: 15_000 });
    await a.context().close();
    await p.reload();
    await p.getByTestId("denunciar-anuncio").click();
    await expect(p.getByTestId("denuncia-estado")).toHaveAttribute("data-estado", "em_analise", { timeout: 15_000 });
    await p.context().close();
  });
});
