import { test, expect, request, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T374 — CONTA-A A5 (mockup perfil-05): Conta › Privacidade.
 *   1. "Conta › Privacidade" (computador), as três chaves (ligada, ligada, desligada), "Baixar meus dados", "Excluir
 *      minha conta" e o rodapé; a lista de confiança continua embaixo. 1280 e 390, com prints.
 *   2. Cada chave grava no toque e volta depois de recarregar.
 *   3. "Baixar meus dados": arquivo JSON só com os dados da própria pessoa (nada de outra conta, nenhum token); sem
 *      login, 401. "Excluir minha conta" abre "Sair da Viva".
 */
const SAIDA = "tests/laboratorio/saida";
const ROTA = "/dashboard/conta/privacidade";
const BASE = process.env.TESTES_BASE_URL ?? "http://localhost:3123";

test.describe("T374 — CONTA-A A5: Privacidade (perfil-05)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });
  const senha = novaSenha();
  const sufixo = novoSufixo();
  const conta = { email: `inq.t374.${sufixo}@lab.vivanomads.test`, nome: "Ana Silva", role: "tenant" as const };
  const outra = { email: `outra.t374.${sufixo}@lab.vivanomads.test`, nome: "Bruno Outro", role: "tenant" as const };
  const ids: string[] = [];
  const privacidade = async () => ((await adm().auth.admin.getUserById(ids[0])).data.user?.user_metadata as { privacidade?: Record<string, boolean> } | undefined)?.privacidade;
  async function como(browser: Browser, w: number): Promise<Page> {
    const p = await entrar(browser, conta.email, senha);
    await p.setViewportSize({ width: w, height: w === 1280 ? 900 : 844 });
    return p;
  }
  test.beforeAll(async () => {
    ids.push(await criarConta(conta, senha), await criarConta(outra, senha));
  });
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  for (const w of [1280, 390]) {
    test(`1. a ${w} px: as chaves, os dois atalhos e o rodapé do desenho`, async ({ browser }) => {
      const p = await como(browser, w);
      await p.goto(ROTA, { waitUntil: "domcontentloaded" });
      await p.getByTestId("tela-privacidade").waitFor({ timeout: 20_000 });
      await expect(p.locator("h1:visible")).toHaveText("Privacidade");
      if (w === 1280) await expect(p.getByTestId("conta-trilha")).toHaveText("Conta › Privacidade");
      else await expect(p.getByTestId("conta-trilha")).toBeHidden();
      await expect(p.getByTestId("privacidade-mostrar_perfil")).toHaveAttribute("aria-checked", "true", { timeout: 20_000 });
      await expect(p.getByTestId("privacidade-aparecer_busca")).toHaveAttribute("aria-checked", "true");
      await expect(p.getByTestId("privacidade-dados_uso")).toHaveAttribute("aria-checked", "false");
      await expect(p.getByTestId("privacidade-baixar")).toHaveAttribute("href", "/api/conta/meus-dados");
      await expect(p.getByTestId("privacidade-excluir")).toHaveAttribute("href", "/dashboard/conta/excluir");
      await expect(p.getByTestId("privacidade-rodape")).toHaveText("Você pode alterar essas permissões a qualquer momento nas configurações.");
      expect(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await p.screenshot({ path: `${SAIDA}/t374-privacidade-${w}.png`, fullPage: true });
      await p.context().close();
    });
  }

  test("2. cada chave grava no toque e volta depois de recarregar", async ({ browser }) => {
    const p = await como(browser, 1280);
    await p.goto(ROTA, { waitUntil: "domcontentloaded" });
    await p.getByTestId("privacidade-aparecer_busca").click({ timeout: 20_000 });
    await expect.poll(privacidade, { timeout: 15_000 }).toEqual({ mostrar_perfil: true, aparecer_busca: false, dados_uso: false });
    await p.getByTestId("privacidade-dados_uso").click();
    await expect.poll(privacidade, { timeout: 15_000 }).toEqual({ mostrar_perfil: true, aparecer_busca: false, dados_uso: true });
    await p.reload({ waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("privacidade-aparecer_busca")).toHaveAttribute("aria-checked", "false", { timeout: 20_000 });
    await expect(p.getByTestId("privacidade-dados_uso")).toHaveAttribute("aria-checked", "true");
    await p.context().close();
  });

  test("3. Baixar meus dados: só os dados dela; sem login, 401; Excluir minha conta abre Sair da Viva", async ({ browser }) => {
    const p = await como(browser, 390);
    const r = await p.request.get("/api/conta/meus-dados");
    expect(r.status()).toBe(200);
    expect(r.headers()["content-disposition"]).toContain("attachment");
    const corpo = await r.text();
    const json = JSON.parse(corpo);
    expect(json.conta.email).toBe(conta.email);
    expect(json.perfil.id).toBe(ids[0]);
    expect(corpo).not.toContain(outra.email);
    expect(corpo).not.toContain(ids[1]);
    expect(corpo).not.toMatch(/"[a-z_]*(token|secret|senha|password)[a-z_]*"\s*:/i);
    const anonimo = await request.newContext({ baseURL: BASE });
    expect((await anonimo.get("/api/conta/meus-dados")).status()).toBe(401);
    await anonimo.dispose();
    await p.goto(ROTA, { waitUntil: "domcontentloaded" });
    await p.getByTestId("privacidade-excluir").click({ timeout: 20_000 });
    await expect(p).toHaveURL(/\/dashboard\/conta\/excluir$/);
    await expect(p.locator("h1:visible")).toHaveText("Sair da Viva");
    await p.context().close();
  });
});
