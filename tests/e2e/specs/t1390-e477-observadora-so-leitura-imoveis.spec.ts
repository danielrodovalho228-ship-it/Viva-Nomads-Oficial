import { test, expect, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { gerarCodigoTotp } from "../fixtures/totp";
import { authFile } from "../fixtures/auth";
import { CHAVE_ANON, NO_LABORATORIO, URL_SUPABASE, adm, apagarContas, criarConta, criarImovelPronto, liberarLimiteLogin, liberarLimiteLoginIp, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1390 — E477 (resíduo, #3144, na main): em /admin/imoveis a observadora da QA (profiles.qa_admin) é SÓ LEITURA em todo
  anúncio, inclusive o de dono de TESTE: nenhuma linha oferece "Pausar" (pausar-imovel) e cada anúncio ativo mostra
  "Só leitura" (so-leitura-qa). O admin comum, no mesmo anúncio de dono de teste, continua com o "Pausar". 390 e 1280 px.
  Login do observador como na t604 (senha + TOTP); só cabe um observador por vez (promover_qa_admin).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const emailObs = `qa+t1390${sufixo}-observador@lab.vivanomads.test`;
const dono = { email: `dono.t1390.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona Teste", role: "owner" as const };
const ids: Record<string, string> = {};
let segredo = "";

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
  await page.goto("/admin/imoveis", { waitUntil: "domcontentloaded" });
  if (/verificar-codigo/.test(page.url())) {
    await page.locator("#codigo-2fa").fill(gerarCodigoTotp(segredo));
    await page.getByRole("button", { name: /confirmar e entrar/i }).click();
    await page.waitForURL(/\/admin\/imoveis/, { timeout: 30_000 });
  }
  return page;
}

test.describe("T1390 — E477: a observadora da QA é só leitura em /admin/imoveis, dado de teste incluído", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    test.setTimeout(300_000);
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio T1390 ${sufixo}`, { ativo: true });
    ids.obs = await criarConta({ email: emailObs, nome: "Olga Observadora", role: "tenant" }, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.obs);
    await expect
      .poll(async () => (await adm().rpc("promover_qa_admin", { p_id: ids.obs })).error?.message ?? "ok", { timeout: 180_000, intervals: [5_000] })
      .toBe("ok");
    const c = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
    const { error: eLogin } = await c.auth.signInWithPassword({ email: emailObs, password: senha });
    if (eLogin) throw eLogin;
    const { data: fator, error: eEnroll } = await c.auth.mfa.enroll({ factorType: "totp", friendlyName: "qa-observador-t1390" });
    if (eEnroll) throw eEnroll;
    segredo = fator!.totp.secret;
    const { data: desafio } = await c.auth.mfa.challenge({ factorId: fator!.id });
    const { error: eVer } = await c.auth.mfa.verify({ factorId: fator!.id, challengeId: desafio!.id, code: gerarCodigoTotp(segredo) });
    if (eVer) throw eVer;
  });
  test.afterAll(async () => {
    if (ids.obs) await adm().rpc("revogar_qa_admin", { p_id: ids.obs });
    await apagarContas([ids.obs, ids.dono]);
  });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: a observadora não vê "Pausar" em anúncio nenhum e vê "Só leitura"`, async ({ browser }) => {
      const page = await entrarObservador(browser, w);
      await expect(page.getByTestId("admin-imoveis")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("so-leitura-qa").first()).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("pausar-imovel")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await page.context().close();
    });
  }

  test("1280 px — admin comum: o mesmo painel segue com o Pausar", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto("/admin/imoveis", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("admin-imoveis")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("pausar-imovel").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("so-leitura-qa")).toHaveCount(0);
    await ctx.close();
  });
});
