import { test, expect, type Browser, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T380 — E35-B (funil do avaliador): a identidade verificada é requisito da ATIVAÇÃO, não do teste.
 *   1. Candidato SEM identidade: "Aprovar para teste" é aceito (vai a "em_teste"; o parceiro nasce em rascunho, sem página
 *      pública) e ele não entra no rodízio de pedido real.
 *   2. Com a avaliação de teste revisada mas sem identidade: ativar não existe na tela, que diz o que falta, um item por linha.
 *   3. Com a identidade confirmada (verificação simulada do laboratório) e o teste: ativar passa.
 */
test.describe("T380 — E35-B: identidade na ativação do avaliador", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  const senha = novaSenha();
  const sufixo = novoSufixo();
  const cand = { email: `cand.t380.${sufixo}@lab.vivanomads.test`, nome: "Carla Candidata Lopes", role: "tenant" as const };
  const dono = { email: `dono.t380.${sufixo}@lab.vivanomads.test`, nome: "Davi Dono Teste", role: "owner" as const };
  const ids: Record<string, string> = {};

  const cred = async () => (await adm().from("avaliadores_credenciamento").select("id, numero_credenciado, status, parceiro_id").eq("id", ids.cred).single()).data as { id: string; numero_credenciado: string; status: string; parceiro_id: string | null };
  async function admin(browser: Browser): Promise<Page> {
    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    await p.goto("/admin/avaliadores", { waitUntil: "domcontentloaded" });
    return p;
  }

  test.beforeAll(async () => {
    ids.cand = await criarConta(cand, senha);
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    ids.imovel = await criarImovelPronto(ids.dono, `Imóvel de teste t380 ${sufixo}`, { ativo: true });
    // Pedido de credenciamento já registrado (o envio pela tela é coberto no t314/t341), com os dados de parceiro.
    const { data: sol, error: eS } = await adm()
      .from("parceiro_solicitacoes")
      .insert({ user_id: ids.cand, email: cand.email, nome: cand.nome, tipo_pessoa: "pf", documento: cpfAleatorio(), categorias: ["vistoria"], cidades: ["Uberlândia"], status: "pendente", origem: "conta" })
      .select("id")
      .single();
    if (eS) throw eS;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: c, error: eC } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ user_id: ids.cand, solicitacao_id: sol!.id, cidade: "Uberlândia", numero_credenciado: n, status: "solicitado", experiencia_link: "https://portfolio.lab.vivanomads.test/t380", conduta_versao: "2026-10-23" })
      .select("id")
      .single();
    if (eC) throw eC;
    ids.cred = c!.id as string;
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("vistoria_pedidos").delete().eq("property_id", ids.imovel ?? "");
    await adm().from("tenant_verifications").delete().eq("tenant_id", ids.cand ?? "");
    await apagarContas([ids.cand, ids.dono]);
  });

  test("1. sem identidade: aprovar para teste aceito; parceiro em rascunho; fora do rodízio real", async ({ browser }) => {
    test.setTimeout(120_000);
    const a = await admin(browser);
    const item = a.locator(`[data-testid="credenciamento-item"][data-numero="${(await cred()).numero_credenciado}"]`);
    await expect(item.getByTestId("credenciamento-pendencia")).toContainText("Na ativação");
    await item.getByTestId("decidir-em_teste").getByRole("button", { name: "Aprovar para teste" }).click();
    await expect.poll(async () => (await cred()).status, { timeout: 20_000 }).toBe("em_teste");
    const c = await cred();
    const { data: parc } = await adm().from("parceiros").select("status").eq("id", c.parceiro_id!).single();
    expect(parc!.status).toBe("rascunho");
    await a.context().close();
  });

  test("2. teste revisado sem identidade: ativar não existe, a tela lista o que falta", async ({ browser }) => {
    const { error } = await adm()
      .from("vistoria_pedidos")
      .insert({ property_id: ids.imovel, owner_id: ids.dono, cidade: "Uberlândia", porte: "q1_2", valor_tabela: 0, status: "laudo_emitido", avaliador_id: ids.cred, teste: true });
    expect(error).toBeNull();
    const a = await admin(browser);
    const item = a.locator(`[data-testid="credenciamento-item"][data-numero="${(await cred()).numero_credenciado}"]`);
    await expect(item.getByTestId("decidir-ativo-bloqueado")).toContainText("A identidade ainda não foi confirmada.");
    await expect(item.getByTestId("decidir-ativo-bloqueado")).not.toContainText("A avaliação de teste ainda não foi feita e revisada.");
    await expect(item.getByTestId("decidir-ativo")).toHaveCount(0);
    expect((await cred()).status).toBe("em_teste");
    await a.context().close();
  });

  test("3. com identidade confirmada e o teste: ativar passa", async ({ browser }) => {
    await adm().from("tenant_verifications").insert({ tenant_id: ids.cand, caf_result: { identity: true, document: true, liveness: true, light: "green", simulado: true }, traffic_light: "green", valid_until: new Date(Date.now() + 365 * 86_400_000).toISOString() });
    const a = await admin(browser);
    const item = a.locator(`[data-testid="credenciamento-item"][data-numero="${(await cred()).numero_credenciado}"]`);
    await expect(item.getByTestId("decidir-ativo-bloqueado")).toHaveCount(0);
    await item.getByTestId("decidir-ativo").getByRole("button", { name: "Aprovar o teste (ativar)" }).click();
    await expect.poll(async () => (await cred()).status, { timeout: 20_000 }).toBe("ativo");
    await a.context().close();
  });
});
