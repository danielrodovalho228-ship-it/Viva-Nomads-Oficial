import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarAdmin, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T460 — ADMIN-1: a barra-alvo do admin. Só no laboratório (conta nova de admin).
   1. Computador (1280), /admin: só a barra do admin (Visão geral, Pendências e os sete grupos), nada do /dashboard;
      "Minha conta →" leva às áreas de usuário; <title> e <h1> de Contratos = rótulo da barra.
   2. /dashboard: o admin vê as áreas de usuário e UM item "Painel admin" (sem os itens do /admin).
   3. Celular (390): "Menu da equipe" abre a barra com os grupos recolhidos.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const admin = { email: `admin.t460.${sufixo}@lab.vivanomads.test`, nome: "Iara Barra" };
const ids: { admin?: string } = {};
const SAIDA = "tests/laboratorio/saida";
const TOPO = ["Visão geral", "Pendências", "Anúncios e pessoas", "Estadias", "Rede", "Cidades e marketing", "Números", "Equipe", "Sistema"];

test.describe("T460 — ADMIN-1: barra do admin", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (conta nova de admin).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeAll(async () => {
    ids.admin = await criarAdmin(admin.email, admin.nome, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.admin]);
  });

  test("1–2. computador: barra do admin em /admin; em /dashboard só 'Painel admin'", async ({ browser }) => {
    const page = await entrar(browser, admin.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/admin/contratos", { waitUntil: "domcontentloaded" });
    const menu = page.getByTestId("menu-cascata").filter({ visible: true });
    await expect(menu).toHaveCount(1, { timeout: 30_000 });
    const topo = menu.locator(":scope > li > a > span.flex-1, :scope > li > button > span.flex-1");
    await expect(topo).toHaveText(TOPO);
    // O grupo da página atual (Estadias) abre sozinho; os outros ficam recolhidos.
    await expect(menu.locator('a[href="/admin/contratos"]')).toHaveAttribute("aria-current", "page");
    await expect(menu.locator('a[href="/admin/parceiros"]')).toHaveCount(0);
    for (const fora of ["Equipe e aprovações", "Fotógrafos", "E-mails de teste"]) await expect(menu.getByText(fora, { exact: true }), fora).toHaveCount(0);
    expect(await menu.locator('a[href^="/dashboard"]').count()).toBe(0);
    await expect(page).toHaveTitle("Contratos — Admin · Viva Nomads");
    await expect(page.locator("main h1").first()).toHaveText("Contratos");
    await page.screenshot({ path: `${SAIDA}/t460-admin-contratos-1280.png` });

    await page.getByTestId("admin-minha-conta").filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/?$/, { timeout: 30_000 });
    const menuUsuario = page.getByTestId("menu-cascata").filter({ visible: true });
    await expect(menuUsuario.locator('a[href="/admin"]')).toHaveCount(1, { timeout: 30_000 });
    await expect(menuUsuario.locator('a[href="/admin"] span.flex-1')).toHaveText("Painel admin");
    expect(await menuUsuario.locator('a[href^="/admin/"]').count()).toBe(0);
    await page.screenshot({ path: `${SAIDA}/t460-dashboard-admin-1280.png` });
    await page.context().close();
  });

  test("3. celular: 'Menu da equipe' abre a barra com os grupos recolhidos", async ({ browser }) => {
    const page = await entrar(browser, admin.email, senha);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await page.getByTestId("admin-abrir-menu").click();
    const menu = page.getByTestId("menu-cascata").filter({ visible: true });
    await expect(menu.locator(":scope > li > a > span.flex-1, :scope > li > button > span.flex-1")).toHaveText(TOPO, { timeout: 30_000 });
    for (const g of TOPO.slice(2)) await expect(menu.locator("li[data-menu-grupo] > button").filter({ hasText: g }).first(), g).toHaveAttribute("aria-expanded", "false");
    await page.screenshot({ path: `${SAIDA}/t460-admin-menu-390.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.context().close();
  });
});
