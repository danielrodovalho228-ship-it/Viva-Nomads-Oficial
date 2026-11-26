import { test, expect, type Browser, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2220 — E1084 (ORDEM-DUET-402): o nome do avaliador vem da CONTA (fonte única), nas superfícies do fluxo. Só no
  laboratório (a chave da avaliação liga só neste navegador, pelo cookie de laboratório). TRAVA EM RASCUNHO: vermelha na
  main de hoje (cada superfície lê parceiros.nome_publico) e verde com o #4102.
  Na prova, a lista de escolha mostrava um nome e o perfil outro. Aqui a conta do avaliador chama-se
  "[TESTE QA] Nara Contanome" (a marca de teste no começo não aparece) e o parceiro tem outro nome público,
  "Empresa Nomepublico". Em cada superfície tem de aparecer o nome da conta — e nunca o do parceiro:
    1. a lista de escolha do dono (o pedido aberto, à espera da escolha): "Nara Contanome";
    2. o admin (/admin/avaliadores), no item do credenciamento: "Nara Contanome";
    3. a página pública do avaliador (/avaliadores/<nº>): o primeiro nome, "Nara".
  Só contas de teste.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const CIDADE = `Uberlândia t2220 ${sufixo}`;
const NOME_CONTA = "Nara Contanome";
const NOME_PARCEIRO = "Empresa Nomepublico";
const avaliador = { email: `aval.t2220.${sufixo}@lab.vivanomads.test`, nome: NOME_CONTA, role: "tenant" as const };
const dono = { email: `dono.t2220.${sufixo}@lab.vivanomads.test`, nome: "Dalia Dona Teste", role: "owner" as const };
const ids: Record<string, string> = {};
const cred = { id: "", numero: "" };

async function comChave(page: Page) {
  if (page.url() === "about:blank") await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.context().addCookies([{ name: "vn_lab_vistoria", value: "1", url: new URL(page.url()).origin }]);
}
async function abrir(browser: Browser, email: string): Promise<Page> {
  const p = await entrar(browser, email, senha);
  await p.setViewportSize({ width: 1280, height: 900 });
  await comChave(p);
  return p;
}

test.describe("T2220 — E1084: o nome do avaliador vem da conta em todas as superfícies do fluxo @E1084", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(async () => {
    ids.av = await criarConta(avaliador, senha);
    ids.dono = await criarConta(dono, senha);
    // A conta com a marca de teste no começo do nome (como as contas de QA); o parceiro com OUTRO nome público.
    await adm().from("profiles").update({ full_name: `[TESTE QA] ${NOME_CONTA}` }).eq("id", ids.av);
    const { data: parc, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.av, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: NOME_PARCEIRO, slug: `aval-t2220-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
      .select("id")
      .single();
    if (error) throw error;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: c, error: eC } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: parc.id, cidade: CIDADE, numero_credenciado: n, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test", conduta_versao: "2026-10-23", ativado_em: new Date().toISOString() })
      .select("id, numero_credenciado")
      .single();
    if (eC) throw eC;
    cred.id = c.id as string;
    cred.numero = c.numero_credenciado as string;
    await adm().from("vistoria_precos").delete().eq("cidade", CIDADE);
    await adm().from("vistoria_precos").insert([
      { cidade: CIDADE, porte: "estudio", valor: 150 },
      { cidade: CIDADE, porte: "q1_2", valor: 250 },
      { cidade: CIDADE, porte: "q3_mais", valor: 350 },
    ]);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio do nome T2220 ${sufixo}`, { ativo: true });
    await adm().from("properties").update({ city: CIDADE }).eq("id", ids.imovel);
    const { data: p, error: eP } = await adm()
      .from("vistoria_pedidos")
      .insert({ property_id: ids.imovel, owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 250, status: "pedido" })
      .select("id")
      .single();
    if (eP) throw eP;
    ids.pedido = p.id as string;
  });

  test.afterAll(async () => {
    if (ids.pedido) await adm().from("vistoria_pedidos").delete().eq("id", ids.pedido);
    if (cred.id) await adm().from("avaliadores_credenciamento").delete().eq("id", cred.id);
    await adm().from("vistoria_precos").delete().eq("cidade", CIDADE);
    await apagarContas([ids.av, ids.dono].filter(Boolean));
  });

  test("1. a lista de escolha do dono mostra o nome da conta, sem a marca de teste e sem o nome do parceiro", async ({ browser }) => {
    const d = await abrir(browser, dono.email);
    await d.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
    const item = d.getByTestId("avaliacao-dono").getByTestId("avaliacao-sugerido").filter({ hasText: `nº ${cred.numero}` });
    await expect(item, "o avaliador está na lista de escolha").toBeVisible({ timeout: 30_000 });
    const t = await item.innerText();
    expect.soft(t, "E1084: a lista mostra o nome da conta").toContain(NOME_CONTA);
    expect.soft(t, "E1084: sem a marca de teste do começo do nome").not.toContain("[TESTE QA]");
    expect.soft(t, "E1084: nunca o nome público do parceiro").not.toContain(NOME_PARCEIRO);
    await d.context().close();
  });

  test("2. o admin mostra o nome da conta no credenciamento", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    await p.goto("/admin/avaliadores", { waitUntil: "domcontentloaded" });
    const item = p.locator(`[data-testid="credenciamento-item"][data-numero="${cred.numero}"]`);
    await expect(item, "o credenciamento está no admin").toBeVisible({ timeout: 30_000 });
    const t = await item.innerText();
    expect.soft(t, "E1084: o admin mostra o nome da conta").toContain(NOME_CONTA);
    expect.soft(t, "E1084: nunca o nome público do parceiro").not.toContain(NOME_PARCEIRO);
    await ctx.close();
  });

  test("3. a página pública do avaliador mostra o primeiro nome da conta", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: { cookies: [], origins: [] } });
    const p = await ctx.newPage();
    await comChave(p);
    await p.goto(`/avaliadores/${cred.numero}`, { waitUntil: "domcontentloaded" });
    const main = p.locator("main");
    await expect(main).toBeVisible({ timeout: 30_000 });
    const t = await main.innerText();
    expect.soft(t, "E1084: a página pública mostra o primeiro nome da conta").toContain("Nara");
    expect.soft(t, "E1084: nunca o nome público do parceiro").not.toContain(NOME_PARCEIRO);
    expect.soft(t, "sem a marca de teste").not.toContain("[TESTE QA]");
    await ctx.close();
  });
});
