import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1671 — E979: o cookie da largura da tela (vn-tela) fica desatualizado quando a largura muda fora do painel. Com
  "larga" guardado e a tela hoje estreita, o 1º carregamento de /dashboard/conta ia para o Perfil, e a pessoa não via o
  menu da Conta. Cobra:
   • 390 px com o cookie "larga" (desatualizado): /dashboard/conta termina no MENU da Conta, o cookie fica "estreita" e
     a marca do redirecionamento some;
   • 390 px, Perfil aberto pelo menu: fica no Perfil (a correção não mexe em quem escolheu o Perfil);
   • 390 px com o cookie desatualizado e âncora antiga (#documento): vai à seção da âncora, como no E798;
   • 1280 px: /dashboard/conta continua indo ao Perfil pelo servidor e fica lá.
*/
const senha = novaSenha();
const conta = { email: `conta.t1671.${novoSufixo()}@lab.vivanomads.test`, nome: "Lara Largura", role: "tenant" as const };
let id: string | undefined;

const cookie = async (page: Page, nome: string) => (await page.context().cookies()).find((c) => c.name === nome)?.value;

/** Deixa o cookie da largura com um valor que NÃO é o da tela de agora, como ficaria se a largura mudasse fora do painel. */
async function cookieDesatualizado(page: Page, valor: "larga" | "estreita") {
  const url = new URL(page.url());
  await page.context().addCookies([{ name: "vn-tela", value: valor, domain: url.hostname, path: "/", sameSite: "Lax" }]);
  expect(await cookie(page, "vn-tela")).toBe(valor);
}

test.describe("T1671 — E979: cookie da largura desatualizado não esconde o menu da Conta", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ mode: "serial" });
  test.beforeAll(async () => {
    id = await criarConta(conta, senha);
  });
  test.afterAll(async () => {
    await apagarContas([id]);
  });

  test("390 px com o cookie 'larga': /dashboard/conta termina no menu da Conta e o cookie é corrigido", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await entrarNaPagina(page, conta.email, senha);
    // Uma página pública: aqui o painel não está montado para regravar o cookie.
    await page.goto("/como-funciona", { waitUntil: "load" });
    await cookieDesatualizado(page, "larga");
    await page.goto("/dashboard/conta", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("conta-menu")).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/dashboard\/conta$/);
    await expect(page.getByTestId("perfil-tela")).toHaveCount(0);
    await expect.poll(() => cookie(page, "vn-tela"), { timeout: 10_000 }).toBe("estreita");
    expect(await cookie(page, "vn-conta-proxy"), "a marca vale para um carregamento só").toBeUndefined();
    // E fica: recarregar não volta ao Perfil.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("conta-menu")).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/dashboard\/conta$/);
  });

  test("390 px: o Perfil aberto pelo menu da Conta fica no Perfil", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await entrarNaPagina(page, conta.email, senha);
    await page.goto("/dashboard/conta", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("conta-menu")).toBeVisible({ timeout: 20_000 });
    await page.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("perfil-tela")).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1_500); // tempo de sobra para uma volta indevida acontecer
    await expect(page).toHaveURL(/\/dashboard\/conta\/perfil$/);
    await expect(page.getByTestId("perfil-tela")).toBeVisible();
  });

  test("390 px com o cookie 'larga' e âncora antiga: vai à seção da âncora (E798), não ao menu", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await entrarNaPagina(page, conta.email, senha);
    await page.goto("/como-funciona", { waitUntil: "load" });
    await cookieDesatualizado(page, "larga");
    await page.goto("/dashboard/conta#documento", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard\/conta\/dados#documento$/, { timeout: 20_000 });
  });

  test("390 px com o cookie 'larga' e a âncora antiga do próprio Perfil: fica no Perfil, sem a âncora", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await entrarNaPagina(page, conta.email, senha);
    await page.goto("/como-funciona", { waitUntil: "load" });
    await cookieDesatualizado(page, "larga");
    await page.goto("/dashboard/conta#perfil-publico", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("perfil-tela")).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/dashboard\/conta\/perfil$/);
    await page.waitForTimeout(1_500); // tempo de sobra para uma volta indevida ao menu acontecer
    await expect(page).toHaveURL(/\/dashboard\/conta\/perfil$/);
    await expect(page.getByTestId("perfil-tela")).toBeVisible();
  });

  test("1280 px, cookie 'larga' já gravado: /dashboard/conta#perfil-publico termina em /perfil sem a âncora (t355, caso 5)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await entrarNaPagina(page, conta.email, senha);
    await page.goto("/dashboard", { waitUntil: "load" });
    await expect.poll(() => cookie(page, "vn-tela"), { timeout: 20_000 }).toBe("larga");
    await page.goto("/dashboard/conta#perfil-publico", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("perfil-tela")).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/dashboard\/conta\/perfil$/);
  });

  test("1280 px: a âncora que ainda existe no Perfil (#pets) fica no endereço", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await entrarNaPagina(page, conta.email, senha);
    await page.goto("/dashboard", { waitUntil: "load" });
    await expect.poll(() => cookie(page, "vn-tela"), { timeout: 20_000 }).toBe("larga");
    await page.goto("/dashboard/conta#pets", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("perfil-tela")).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1_500);
    await expect(page).toHaveURL(/\/dashboard\/conta\/perfil#pets$/);
  });

  test("1280 px: /dashboard/conta segue indo ao Perfil pelo servidor e fica lá; a marca some", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await entrarNaPagina(page, conta.email, senha);
    await page.goto("/dashboard", { waitUntil: "load" });
    await expect.poll(() => cookie(page, "vn-tela"), { timeout: 20_000 }).toBe("larga");
    const r = await page.request.get("/dashboard/conta", { maxRedirects: 0 });
    expect(r.status(), "redirecionamento HTTP").toBe(307);
    expect(r.headers()["location"]).toMatch(/\/dashboard\/conta\/perfil$/);
    await page.goto("/dashboard/conta", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("perfil-tela")).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1_500);
    await expect(page).toHaveURL(/\/dashboard\/conta\/perfil$/);
    await expect.poll(() => cookie(page, "vn-conta-proxy"), { timeout: 10_000 }).toBeUndefined();
  });
});
