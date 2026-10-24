import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T390 — DESTINO-PESSOAL-B: "Outro local" pessoal na busca. Só no laboratório (OSM simulado: nada sai para a rede;
  endereço com "inexistente" não é achado).
   1. Sem login: o servidor acha o local; ele vai só na URL (rótulo sem número) e nada é guardado.
   2. Endereço inválido: "Não achamos este endereço." + "Não achei meu local" → pedido (nome + cidade) na fila do admin.
   3. Logada: o local fica guardado só para ela e volta como "Seus locais".
   4. Admin: vê só o agregado — a região com 5 pessoas aparece, a com 4 não; nenhum rótulo pessoal na tela;
      "Promover a âncora" leva o centro da região ao cadastro; o pedido "Não achei" é resolvido na mesma tela.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: string[] = [];
const contas = Array.from({ length: 5 }, (_, n) => ({ email: `destino.pessoal.${n}.${sufixo}@lab.vivanomads.test`, nome: `Pessoa Destino ${n}`, role: "tenant" as const }));
const SEGREDO = `Casa da Tia ${sufixo}`;
const LUGAR = `Clínica Lab ${sufixo}`;
// Cinco pessoas na mesma região de ~300 m; quatro em outra (não aparece).
const CINCO = { lat: -18.905, lng: -48.272 };
const QUATRO = { lat: -18.951, lng: -48.301 };

const semRolagemLateral = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

test.describe("T390 — DESTINO-PESSOAL-B: Outro local pessoal", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    for (const c of contas) ids.push(await criarConta(c, senha));
  });

  test.afterAll(async () => {
    await adm().from("destinos_nao_achados").delete().eq("nome", LUGAR);
    await apagarContas(ids);
  });

  test("1. sem login: o local vai só na URL e nada é guardado", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const antes = (await adm().from("destinos_pessoais").select("id", { count: "exact", head: true })).count ?? 0;
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    const campo = page.getByTestId("campo-destino");
    await campo.getByTestId("outro-local-texto").fill(`Hospital do Lab ${sufixo}, 123`);
    await campo.getByTestId("outro-local-buscar").click();
    await expect(campo.getByTestId("destino-digitado")).toContainText("Hospital do Lab", { timeout: 20_000 });
    await expect(campo.getByTestId("destino-digitado")).not.toContainText("123");
    await expect(page).toHaveURL(/dlat=-?\d+\.\d{2}&dlng=-?\d+\.\d{2}/);
    expect((await adm().from("destinos_pessoais").select("id", { count: "exact", head: true })).count ?? 0).toBe(antes);
    await semRolagemLateral(page);
    await page.screenshot({ path: "tests/laboratorio/saida/t390-1-outro-local-390.png", fullPage: true });
    await ctx.close();
  });

  test("2. endereço inválido: 'Não achamos este endereço.' e o pedido 'Não achei meu local'", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    const campo = page.getByTestId("campo-destino");
    await campo.getByTestId("outro-local-texto").fill("Rua Inexistente 999");
    await campo.getByTestId("outro-local-buscar").click();
    await expect(campo.getByTestId("outro-local-erro")).toHaveText("Não achamos este endereço.", { timeout: 20_000 });
    await campo.getByTestId("nao-achei-abrir").click();
    await expect(campo.getByTestId("nao-achei-abrir")).toHaveCount(0);
    await campo.getByTestId("nao-achei-nome").fill(LUGAR);
    await campo.getByTestId("nao-achei-cidade").fill("Uberlândia");
    await campo.getByTestId("nao-achei-enviar").click();
    await expect(campo.getByTestId("nao-achei-msg")).toContainText("Pedido enviado", { timeout: 20_000 });
    const { data } = await adm().from("destinos_nao_achados").select("nome, cidade, resolvido_em").eq("nome", LUGAR);
    expect(data).toEqual([{ nome: LUGAR, cidade: "Uberlândia", resolvido_em: null }]);
    await page.screenshot({ path: "tests/laboratorio/saida/t390-2-nao-achei-1280.png", fullPage: true });
    await ctx.close();
  });

  test("3. logada: o local fica só com ela e volta como 'Seus locais'", async ({ browser }) => {
    const page = await entrar(browser, contas[0].email, senha);
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    const campo = page.getByTestId("campo-destino");
    await campo.getByTestId("outro-local-texto").fill(`Trabalho da Pessoa ${sufixo}`);
    await campo.getByTestId("outro-local-buscar").click();
    await expect(campo.getByTestId("destino-digitado")).toBeVisible({ timeout: 20_000 });
    await expect.poll(async () => (await adm().from("destinos_pessoais").select("rotulo").eq("user_id", ids[0])).data?.length ?? 0, { timeout: 20_000 }).toBe(1);
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("destinos-pessoais").getByTestId("destino-pessoal")).toContainText(`Trabalho da Pessoa ${sufixo}`, { timeout: 20_000 });
    await page.getByTestId("destino-pessoal").first().click();
    await expect(page).toHaveURL(/dlat=/);
    await page.context().close();
  });

  test("4. admin: só o agregado (5+ pessoas), 'Promover a âncora' e o pedido resolvido", async ({ browser }) => {
    test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
    const agora = new Date().toISOString();
    const { error } = await adm()
      .from("destinos_pessoais")
      .insert([
        ...ids.map((user_id) => ({ user_id, rotulo: SEGREDO, lat: CINCO.lat, lng: CINCO.lng, usado_em: agora })),
        ...ids.slice(0, 4).map((user_id) => ({ user_id, rotulo: SEGREDO, lat: QUATRO.lat, lng: QUATRO.lng, usado_em: agora })),
      ]);
    expect(error).toBeNull();
    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto("/admin/destinos", { waitUntil: "domcontentloaded" });
    const pontos = page.getByTestId("pontos-pessoais");
    // A região dos cinco: centro da célula de ~300 m (nunca o ponto de alguém).
    const linha = pontos.locator('[data-testid="ponto-pessoal"][data-pessoas="5"]');
    await expect(linha.first()).toBeVisible({ timeout: 30_000 });
    await expect(pontos).not.toContainText("-18.95"); // a região dos quatro não aparece
    await expect(page.getByText(SEGREDO)).toHaveCount(0);
    await page.screenshot({ path: "tests/laboratorio/saida/t390-4-admin-1280.png", fullPage: true });
    await linha.first().getByTestId("promover-ancora").click();
    await expect(page.getByTestId("promover-aviso")).toBeVisible();
    await expect(page.getByTestId("destino-lat")).toHaveValue(/^-18\.90/);
    await expect(page.getByTestId("destino-lng")).toHaveValue(/^-48\.27/);
    const pedido = page.getByTestId("nao-achado").filter({ hasText: LUGAR });
    await expect(pedido).toBeVisible();
    await pedido.getByTestId("resolver-nao-achado").click();
    await expect(page.getByTestId("nao-achado").filter({ hasText: LUGAR })).toHaveCount(0, { timeout: 20_000 });
    await ctx.close();
  });
});
