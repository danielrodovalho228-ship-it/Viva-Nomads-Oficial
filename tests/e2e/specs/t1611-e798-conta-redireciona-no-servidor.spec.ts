import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1611 — E798 (prova ao vivo do piloto do E793, 12/11): /dashboard/conta e /dashboard/conta/avaliacoes abriam com a
  área principal em branco e redirecionavam no NAVEGADOR. Agora o redirecionamento é do servidor (proxy), antes de
  desenhar:
   • /dashboard/conta/avaliacoes?aba=recentes → 307 para /dashboard/avaliacoes?aba=recebidas&filtro=recentes;
   • /dashboard/conta no computador (o painel já gravou a largura) → 307 para /dashboard/conta/perfil, que abre com o
     conteúdo; a âncora antiga (#documento) ainda leva à seção certa;
   • no celular, /dashboard/conta segue sendo o menu da Conta (sem redirecionar).
*/
const senha = novaSenha();
const conta = { email: `conta.t1611.${novoSufixo()}@lab.vivanomads.test`, nome: "Rita Redireciona", role: "tenant" as const };
let id: string | undefined;

test.describe("T1611 — E798: a Conta redireciona no servidor", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ mode: "serial" });
  test.beforeAll(async () => {
    id = await criarConta(conta, senha);
  });
  test.afterAll(async () => {
    await apagarContas([id]);
  });

  test("avaliações antigas: o servidor responde 307 com o destino (filtro preservado), sem desenhar a casca", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await entrarNaPagina(page, conta.email, senha);
    const r = await page.request.get("/dashboard/conta/avaliacoes?aba=recentes", { maxRedirects: 0 });
    expect(r.status(), "redirecionamento HTTP, não uma página 200 que redireciona depois").toBe(307);
    expect(r.headers()["location"]).toMatch(/\/dashboard\/avaliacoes\?aba=recebidas&filtro=recentes$/);
  });

  test("1280 px: /dashboard/conta vai ao Perfil pelo servidor e o Perfil abre com o conteúdo; a âncora antiga vai à seção", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await entrarNaPagina(page, conta.email, senha);
    // O painel grava a largura da tela deste aparelho (cookie) na primeira visita.
    await page.goto("/dashboard", { waitUntil: "load" });
    await expect.poll(async () => (await page.context().cookies()).find((c) => c.name === "vn-tela")?.value, { timeout: 20_000 }).toBe("larga");
    const r = await page.request.get("/dashboard/conta", { maxRedirects: 0 });
    expect(r.status(), "redirecionamento HTTP").toBe(307);
    expect(r.headers()["location"]).toMatch(/\/dashboard\/conta\/perfil$/);
    const resp = await page.goto("/dashboard/conta", { waitUntil: "domcontentloaded" });
    expect(resp?.request().redirectedFrom(), "a página /dashboard/conta não chegou a ser desenhada").toBeTruthy();
    await expect(page).toHaveURL(/\/dashboard\/conta\/perfil$/);
    await expect(page.getByTestId("perfil-tela")).toBeVisible({ timeout: 20_000 });
    await page.goto("/dashboard/conta#documento", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard\/conta\/dados#documento$/, { timeout: 20_000 });
  });

  test("390 px: /dashboard/conta segue sendo o menu da Conta (sem redirecionar)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await entrarNaPagina(page, conta.email, senha);
    await page.goto("/dashboard", { waitUntil: "load" });
    await expect.poll(async () => (await page.context().cookies()).find((c) => c.name === "vn-tela")?.value, { timeout: 20_000 }).toBe("estreita");
    const r = await page.request.get("/dashboard/conta", { maxRedirects: 0 });
    expect(r.status()).toBe(200);
    await page.goto("/dashboard/conta", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("conta-menu")).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/dashboard\/conta$/);
  });
});
