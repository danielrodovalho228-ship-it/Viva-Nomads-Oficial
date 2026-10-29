import { test, expect, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { gerarCodigoTotp } from "../fixtures/totp";
import { authFile } from "../fixtures/auth";
import { CHAVE_ANON, NO_LABORATORIO, URL_SUPABASE, adm, apagarContas, criarConta, liberarLimiteLogin, liberarLimiteLoginIp, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T604 — E216: o admin observador da QA (profiles.qa_admin) não vê o link "Caixa dos Sócios" na barra do admin (a página
  já é 404 para ele), nem na Visão geral. O admin comum continua vendo o link. 1280 e 390.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const emailObs = `qa+t604${sufixo}-observador@lab.vivanomads.test`;
const ids: Record<string, string> = {};
let segredo = "";

/** Login por senha (aal1) e o código do autenticador no /admin (aal2), como a QA entra. */
async function entrarObservador(browser: Browser, largura: 390 | 1280): Promise<Page> {
  await liberarLimiteLogin(emailObs);
  await liberarLimiteLoginIp();
  const ctx = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
  const page = await ctx.newPage();
  await page.goto("/auth?senha=1", { waitUntil: "domcontentloaded" });
  const campoEmail = page.locator('input[name="email"], input[type="email"]').first();
  const campoSenha = page.locator('input[name="password"], input[type="password"]').first();
  await expect(async () => {
    if (/verificar-codigo|\/dashboard|\/admin/.test(page.url())) return;
    if ((await campoEmail.inputValue({ timeout: 5_000 })) !== emailObs) await campoEmail.fill(emailObs, { timeout: 5_000 });
    if ((await campoSenha.inputValue({ timeout: 5_000 })) !== senha) await campoSenha.fill(senha, { timeout: 5_000 });
    await page.locator("form").getByRole("button", { name: /^entrar$/i }).click({ timeout: 5_000 });
    await page.waitForURL(/verificar-codigo|\/dashboard|\/admin/, { timeout: 15_000 });
  }).toPass({ timeout: 50_000 });
  await page.goto("/admin/agentes", { waitUntil: "domcontentloaded" });
  if (/verificar-codigo/.test(page.url())) {
    await page.locator("#codigo-2fa").fill(gerarCodigoTotp(segredo));
    await page.getByRole("button", { name: /confirmar e entrar/i }).click();
    await page.waitForURL(/\/admin\/agentes/, { timeout: 30_000 });
  }
  return page;
}

async function menuDoAdmin(page: Page, largura: 390 | 1280) {
  if (largura === 390) await page.getByTestId("admin-abrir-menu").click();
  const menu = page.getByTestId("menu-cascata").filter({ visible: true });
  await expect(menu).toHaveCount(1, { timeout: 30_000 });
  // Em /admin/agentes o grupo Equipe abre sozinho no computador; no celular os grupos vêm recolhidos.
  const equipe = menu.locator("li[data-menu-grupo] > button").filter({ hasText: "Equipe" }).first();
  if ((await equipe.getAttribute("aria-expanded")) === "false") await equipe.click();
  await expect(menu.locator('a[href="/admin/agentes"]')).toBeVisible({ timeout: 15_000 });
  return menu;
}

test.describe("T604 — E216: admin observador sem 'Caixa dos Sócios' na barra e na Visão geral", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.obs = await criarConta({ email: emailObs, nome: "Olga Observadora", role: "tenant" }, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.obs);
    const { error } = await adm().rpc("promover_qa_admin", { p_id: ids.obs });
    if (error) throw error;
    // 2FA próprio pelo fluxo do Supabase (enroll → challenge → verify); o segredo fica só aqui.
    const c = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
    const { error: eLogin } = await c.auth.signInWithPassword({ email: emailObs, password: senha });
    if (eLogin) throw eLogin;
    const { data: fator, error: eEnroll } = await c.auth.mfa.enroll({ factorType: "totp", friendlyName: "qa-observador-t604" });
    if (eEnroll) throw eEnroll;
    segredo = fator!.totp.secret;
    const { data: desafio } = await c.auth.mfa.challenge({ factorId: fator!.id });
    const { error: eVer } = await c.auth.mfa.verify({ factorId: fator!.id, challengeId: desafio!.id, code: gerarCodigoTotp(segredo) });
    if (eVer) throw eVer;
  });
  test.afterAll(async () => {
    if (ids.obs) await adm().rpc("revogar_qa_admin", { p_id: ids.obs });
    await apagarContas([ids.obs]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — observador: Equipe só com a Central de Agentes; nada da Caixa na Visão geral`, async ({ browser }) => {
      const page = await entrarObservador(browser, largura);
      const menu = await menuDoAdmin(page, largura);
      await expect(menu.locator('a[href="/admin/socios"]')).toHaveCount(0);
      await expect(menu.getByText("Caixa dos Sócios", { exact: true })).toHaveCount(0);
      await page.screenshot({ path: `${SAIDA}/t604-observador-menu-${largura}.png` });
      await page.goto("/admin", { waitUntil: "domcontentloaded" });
      await expect(page.locator("main h1").first()).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(/Caixa dos Sócios/)).toHaveCount(0);
      await page.context().close();
    });
  }

  test("1280 px — admin comum: a Caixa dos Sócios continua na barra", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto("/admin/agentes", { waitUntil: "domcontentloaded" });
    const menu = await menuDoAdmin(page, 1280);
    await expect(menu.locator('a[href="/admin/socios"]')).toHaveText("Caixa dos Sócios");
    await ctx.close();
  });
});
