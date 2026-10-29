import { test, expect, type Browser, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

// Portão de #1483 (E217) e #1484 (E190 parte 2) (Pista C, 29/10): roda no lab-crítico deste PR.
// Regressão dos merges #1472–#1479 (Pista C, 29/10): mexido pelos merges e pulado pelo teto da suíte completa; roda no portão do PR.
/**
 * T313 — Prompt 50: ativação por papel, funil e lembretes honestos (laboratório).
 *   1. proprietário: o checklist do Início some na ATIVAÇÃO (1º anúncio publicado) e a data fica gravada 1× por papel;
 *   2. verificação: 1ª reprovação automática → motivo legível + nova tentativa na hora; 2ª → análise de uma pessoa
 *      (topo de decisões e /admin/documentos) → a equipe aprova → identidade confirmada;
 *   3. funil no admin: a maior queda no topo, a fórmula escrita e o número que abre a lista;
 *   4. chamado: quem abriu vê o estado (aberto · respondido · resolvido); o atrasado entra no topo do admin.
 * O lembrete do rascunho parado (3 dias, "Faltam N passos…") sai pelo cron diário, que no laboratório não tem
 * CRON_SECRET: a regra fica nos testes de unidade (lembretes/regras, automacoes/regras) e no reteste do Muse.
 */
test.describe("T313 — ativação e funil (50)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  const senha = novaSenha();
  const sufixo = novoSufixo();
  const dono = { email: `dono.t313.${sufixo}@lab.vivanomads.test`, nome: "Odete Dona", role: "owner" as const };
  const pessoa = { email: `pessoa.t313.${sufixo}@lab.vivanomads.test`, nome: "Paulo Verifica", role: "tenant" as const };
  const ids: Record<string, string> = {};
  const chamados: string[] = [];

  async function admin(browser: Browser, url: string): Promise<Page> {
    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(url, { waitUntil: "domcontentloaded" });
    return p;
  }

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.pessoa = await criarConta(pessoa, senha);
    // A verificação simulada é de conta de teste (is_teste); o cookie de laboratório força a reprovação.
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.pessoa);
    ids.imovel = await criarImovelPronto(ids.dono, `Ativação t313 ${sufixo}`, { ativo: false });
  });

  test.afterAll(async () => {
    if (chamados.length) await adm().from("chamados").delete().in("id", chamados);
    await adm().from("verificacao_revisoes").delete().eq("user_id", ids.pessoa ?? "");
    await adm().from("tenant_verifications").delete().eq("tenant_id", ids.pessoa ?? "");
    await adm().from("ativacoes").delete().in("user_id", [ids.dono, ids.pessoa].filter(Boolean));
    await apagarContas([ids.dono, ids.pessoa]);
  });

  // E218 (L-71): o Início do PROP-6 (#1349) tinha deixado o checklist do dono de fora; ele voltou ao InicioDono.
  test("1. proprietário: o checklist some na publicação e a ativação fica gravada uma vez", async ({ browser }) => {
    // L-71 (Pista C, 29/10): desde o PROP-6 (Início do dono = InicioDono) e o E167 (Início do morador sem o checklist do
    // dono), o checklist de ativação do proprietário não aparece em nenhum Início. Quem corrigir tira esta linha.
    test.fail(true, "L-71: o checklist de ativação do proprietário não aparece no Início (PROP-6 + E167)");
    test.setTimeout(150_000);
    const d = await entrar(browser, dono.email, senha);
    await d.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(d.locator('[data-testid="checklist-ativacao"][data-papel="proprietario"]')).toBeVisible({ timeout: 20_000 });
    expect(((await adm().from("ativacoes").select("papel").eq("user_id", ids.dono)).data ?? []).length).toBe(0);
    // Publicou (o que a publicação grava): no próximo Início, o checklist do papel some e a data fica gravada.
    await adm().from("properties").update({ status: "active" }).eq("id", ids.imovel);
    await d.reload({ waitUntil: "domcontentloaded" });
    await expect(d.locator('[data-testid="checklist-ativacao"][data-papel="proprietario"]')).toHaveCount(0, { timeout: 20_000 });
    await expect.poll(async () => ((await adm().from("ativacoes").select("papel, ativado_em").eq("user_id", ids.dono)).data ?? []).map((a) => a.papel), { timeout: 15_000 }).toContain("proprietario");
    const { data: a1 } = await adm().from("ativacoes").select("ativado_em").eq("user_id", ids.dono).eq("papel", "proprietario").single();
    // Despublicar não desativa e não grava de novo (1× por papel).
    await adm().from("properties").update({ status: "paused" }).eq("id", ids.imovel);
    await d.reload({ waitUntil: "domcontentloaded" });
    await expect(d.locator('[data-testid="checklist-ativacao"][data-papel="proprietario"]')).toHaveCount(0);
    const { data: a2 } = await adm().from("ativacoes").select("ativado_em").eq("user_id", ids.dono).eq("papel", "proprietario").single();
    expect(a2!.ativado_em).toBe(a1!.ativado_em);
    await d.context().close();
  });

  test("2. verificação: motivo legível e nova tentativa; na 2ª, uma pessoa analisa e aprova", async ({ browser }) => {
    test.setTimeout(200_000);
    const p = await entrar(browser, pessoa.email, senha);
    await p.context().addCookies([{ name: "vn_lab_caf", value: "foto_escura", url: new URL(p.url()).origin }]);
    await p.goto("/dashboard/verificacao", { waitUntil: "domcontentloaded" });
    await p.getByTestId("verificacao-teste-verificar").click();
    const aviso = p.getByTestId("verificacao-reprovada");
    await expect(aviso).toHaveAttribute("data-acao", "tentar_de_novo", { timeout: 20_000 });
    await expect(aviso).toContainText("Foto escura");
    await expect(aviso).toContainText("janela");
    await expect(aviso).not.toContainText(/falha na verifica|algo deu errado/i);
    await p.getByTestId("verificacao-teste-verificar").click(); // "Tentar de novo agora"
    await expect(aviso).toHaveAttribute("data-acao", "analise_humana", { timeout: 20_000 });
    await expect(p.getByTestId("verificacao-teste-verificar")).toHaveCount(0);
    await expect.poll(async () => (await adm().from("verificacao_revisoes").select("motivo").eq("user_id", ids.pessoa).is("decidido_em", null).maybeSingle()).data?.motivo ?? null, { timeout: 15_000 }).toBe("foto_escura");
    expect(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await p.screenshot({ path: "tests/laboratorio/saida/t313-verificacao-390.png", fullPage: true });

    // A equipe vê no topo de decisões e decide em /admin/documentos.
    const a = await admin(browser, "/admin");
    await expect(a.getByText(/verificaç(ão|ões) de identidade para analisar/).first()).toBeVisible({ timeout: 20_000 });
    await a.goto("/admin/documentos#verificacao", { waitUntil: "domcontentloaded" });
    const item = a.locator(`[data-testid="verificacao-revisao"][data-usuario="${ids.pessoa}"]`);
    await expect(item).toContainText("Foto escura");
    await item.getByLabel("Decisão").selectOption("aprovada");
    await item.getByRole("button", { name: "Registrar a decisão" }).click();
    await expect.poll(async () => (await adm().from("verificacao_revisoes").select("resultado").eq("user_id", ids.pessoa).maybeSingle()).data?.resultado ?? null, { timeout: 20_000 }).toBe("aprovada");
    const { data: laudos } = await adm().from("tenant_verifications").select("traffic_light").eq("tenant_id", ids.pessoa).order("created_at", { ascending: false }).limit(1);
    expect(laudos?.[0]?.traffic_light).toBe("green");
    await a.context().close();
    await p.context().close();
  });

  test("3. funil no admin: maior queda no topo, fórmula escrita e o número abre a lista", async ({ browser }) => {
    test.setTimeout(120_000);
    const a = await admin(browser, "/admin/funil");
    await expect(a.getByTestId("funil-topo")).toBeVisible({ timeout: 20_000 });
    await expect(a.getByTestId("funil-etapa")).toHaveCount(6);
    await expect(a.locator('[data-testid="funil-etapa"][data-chave="conta_intencao"]')).toContainText("Fórmula: contas novas que responderam a intenção");
    await a.locator('[data-testid="funil-etapa"][data-chave="conta_intencao"]').getByRole("link").click();
    await expect(a.getByTestId("funil-lista")).toBeVisible({ timeout: 20_000 });
    await expect(a.getByTestId("funil-verificacao")).toContainText("Iniciaram");
    await a.screenshot({ path: "tests/laboratorio/saida/t313-funil-1280.png", fullPage: true });
    await a.context().close();
  });

  test("4. chamado: quem abriu vê o estado; o sem resposta há mais de 24 h entra no topo do admin", async ({ browser }) => {
    test.setTimeout(120_000);
    const agora = Date.now();
    const { data, error } = await adm()
      .from("chamados")
      .insert({
        usuario_id: ids.dono,
        tipo: "suporte",
        categoria: "outro",
        prioridade: "p3",
        status: "aberto",
        canal: "site",
        assunto: `Lab T313 ${sufixo}`,
        responsavel_tipo: "humano",
        prazo_primeira_resposta: new Date(agora - 3_600_000).toISOString(),
        prazo_resolucao: new Date(agora + 86_400_000).toISOString(),
        criado_em: new Date(agora - 26 * 3_600_000).toISOString(),
        simulacao: false,
      })
      .select("id")
      .single();
    if (error) throw error;
    chamados.push(data.id as string);
    const d = await entrar(browser, dono.email, senha);
    await d.goto("/ajuda/fale-com-a-viva", { waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("chamado-estado").first()).toHaveAttribute("data-estado", "aberto", { timeout: 20_000 });
    await d.context().close();
    const a = await admin(browser, "/admin");
    await expect(a.getByText(/chamados? sem resposta de uma pessoa há mais de 24 h/).first()).toBeVisible({ timeout: 20_000 });
    await a.context().close();
  });
});
