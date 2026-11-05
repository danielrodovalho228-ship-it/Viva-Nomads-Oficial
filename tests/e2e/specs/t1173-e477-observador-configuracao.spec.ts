import { test, expect, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { gerarCodigoTotp } from "../fixtures/totp";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { CHAVE_ANON, NO_LABORATORIO, URL_SUPABASE, adm, apagarContas, criarConta, liberarLimiteLogin, liberarLimiteLoginIp, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1173 — E477 (#2678, 05/11): o admin observador da QA (profiles.qa_admin) não escreve na CONFIGURAÇÃO da plataforma —
 * Cidades, Destinos e Marketing. Antes as ações do servidor dessas telas não perguntavam pelo observador e a tela mostrava
 * os controles habilitados; agora os controles saem e a tela mostra o aviso de só leitura (so-leitura-qa). O E477 entrou
 * só com teste de unidade; aqui é a tela, 390 e 1280, comparando o observador com o admin comum do laboratório:
 *   1. observador: so-leitura-qa nas três telas; sem "Liberar"/"Pausar" em Cidades, sem o formulário e sem "Ativar/Desativar"
 *      em Destinos (destino-form, alternar-destino) e sem o "Novo lançamento" em Marketing;
 *   2. admin comum (controle): sem so-leitura-qa e com o formulário de Destinos e o "Novo lançamento" de Marketing.
 * Um observador por vez (promover_qa_admin): espera outra spec soltar o dela, como a t655.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const emailObs = `qa+t1173${sufixo}-observador@lab.vivanomads.test`;
const ids: { obs?: string } = {};
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
  await page.goto("/admin/cidades", { waitUntil: "domcontentloaded" });
  if (/verificar-codigo/.test(page.url())) {
    await page.locator("#codigo-2fa").fill(gerarCodigoTotp(segredo));
    await page.getByRole("button", { name: /confirmar e entrar/i }).click();
    await page.waitForURL(/\/admin\/cidades/, { timeout: 30_000 });
  }
  return page;
}

test.describe("T1173 — E477: o observador da QA só lê Cidades, Destinos e Marketing", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async ({}, info) => {
    if (info.project.name !== "chromium") return;
    test.setTimeout(300_000);
    ids.obs = await criarConta({ email: emailObs, nome: "Olívia Observadora", role: "tenant" }, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.obs);
    await expect
      .poll(async () => (await adm().rpc("promover_qa_admin", { p_id: ids.obs })).error?.message ?? "ok", { timeout: 180_000, intervals: [5_000] })
      .toBe("ok");
    const c = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
    const { error: eLogin } = await c.auth.signInWithPassword({ email: emailObs, password: senha });
    if (eLogin) throw eLogin;
    const { data: fator, error: eEnroll } = await c.auth.mfa.enroll({ factorType: "totp", friendlyName: "qa-observador-t1173" });
    if (eEnroll) throw eEnroll;
    segredo = fator!.totp.secret;
    const { data: desafio } = await c.auth.mfa.challenge({ factorId: fator!.id });
    const { error: eVer } = await c.auth.mfa.verify({ factorId: fator!.id, challengeId: desafio!.id, code: gerarCodigoTotp(segredo) });
    if (eVer) throw eVer;
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    if (ids.obs) await adm().rpc("revogar_qa_admin", { p_id: ids.obs });
    await apagarContas([ids.obs]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — observador só lê; o admin comum tem os controles`, async ({ browser }, info) => {
      test.skip(info.project.name !== "chromium", "roda só no projeto chromium");
      const page = await entrarObservador(browser, largura);
      try {
        // Cidades: aviso de só leitura e nenhum "Liberar"/"Pausar".
        await expect(page.getByTestId("so-leitura-qa").first()).toBeVisible({ timeout: 30_000 });
        await expect(page.locator("main").getByRole("button", { name: /^(Liberar|Pausar)$/ })).toHaveCount(0);
        // Destinos: sem o formulário e sem o alternar.
        await page.goto("/admin/destinos", { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("so-leitura-qa").first()).toBeVisible({ timeout: 30_000 });
        await expect(page.getByTestId("destino-form")).toHaveCount(0);
        await expect(page.getByTestId("alternar-destino")).toHaveCount(0);
        // Marketing: sem o "Novo lançamento".
        await page.goto("/admin/marketing", { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("so-leitura-qa").first()).toBeVisible({ timeout: 30_000 });
        await expect(page.getByText("Novo lançamento", { exact: true })).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await page.context().close();
      }

      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const admin = await ctx.newPage();
      try {
        await admin.goto("/admin/destinos", { waitUntil: "domcontentloaded" });
        await expect(admin.getByTestId("destino-form")).toBeVisible({ timeout: 30_000 });
        await expect(admin.getByTestId("so-leitura-qa")).toHaveCount(0);
        await admin.goto("/admin/marketing", { waitUntil: "domcontentloaded" });
        await expect(admin.getByText("Novo lançamento", { exact: true })).toBeVisible({ timeout: 30_000 });
        await expect(admin.getByTestId("so-leitura-qa")).toHaveCount(0);
      } finally {
        await ctx.close();
      }
    });
  }
});
