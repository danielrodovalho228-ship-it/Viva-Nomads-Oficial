import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { gerarCodigoTotp } from "../fixtures/totp";
import { CHAVE_ANON, NO_LABORATORIO, URL_SUPABASE, apagarContas, criarConta, entrar, liberarLimiteLogin, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T247 — 2FA: alterar a senha em sessão aal1 pede o código e só então salva (ordem 7f8448c0, do PR #425).
 * Conta NOVA, só deste spec. A sessão do 2º login (só senha) é aal1: sem código a troca é recusada e a senha antiga continua valendo;
 * com o código certo a senha nova passa a valer.
 */
const senha = novaSenha();
const senhaNova = novaSenha();
const dono = { email: `dono.2fa.senha.${novoSufixo()}@lab.vivanomads.test`, nome: "Sara Senha Duas Etapas", role: "owner" as const };
let donoId: string | undefined;

async function senhaFunciona(valor: string): Promise<boolean> {
  await liberarLimiteLogin(dono.email);
  const anon = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
  const { error } = await anon.auth.signInWithPassword({ email: dono.email, password: valor });
  return !error;
}

test.describe.configure({ mode: "serial" });

test.describe("T247 — 2FA e troca de senha (390px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.use({ viewport: { width: 390, height: 800 } });

  test.beforeAll(async () => {
    donoId = await criarConta(dono, senha, true);
  });
  test.afterAll(async () => {
    await apagarContas([donoId]);
  });

  test("com 2FA ativo, a sessão só com senha pede o código; código errado não troca; código certo troca", async ({ browser }) => {
    test.setTimeout(180000);
    // 1) Ativa o 2FA pela tela.
    const ativa = await entrar(browser, dono.email, senha);
    await ativa.goto("/dashboard/conta/seguranca");
    await expect(async () => {
      await ativa.getByRole("button", { name: /Ativar duas etapas/ }).click({ timeout: 5_000 });
      await expect(ativa.getByTestId("chave-2fa")).toBeVisible({ timeout: 4_000 });
    }).toPass({ timeout: 45_000 });
    const chave = ((await ativa.getByTestId("chave-2fa").textContent()) ?? "").replace(/\s/g, "");
    await ativa.locator("#codigo-ativar").fill(gerarCodigoTotp(chave));
    await ativa.getByRole("button", { name: "Confirmar código e ativar" }).click();
    await expect(ativa.getByRole("button", { name: "Remover verificação" })).toBeVisible({ timeout: 15000 });
    await ativa.context().close();

    // 2) Nova sessão só com senha (aal1): o login com 2FA ativo cai na tela do código; pulamos para a conta pela sessão da senha.
    await liberarLimiteLogin(dono.email);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto("/auth?senha=1", { waitUntil: "domcontentloaded" });
    // Um clique antes da hidratação vira envio nativo e recarrega /auth vazio (lab de 318bc26): preenche o que estiver
    // vazio e clica de novo até sair de /auth, como o entrar() do laboratório.
    const campoEmail = page.locator('input[name="email"], input[type="email"]').first();
    const campoSenha = page.locator('input[name="password"], input[type="password"]').first();
    await expect(async () => {
      if (/verificar-codigo|\/dashboard/.test(page.url())) return;
      if ((await campoEmail.inputValue({ timeout: 5_000 })) !== dono.email) await campoEmail.fill(dono.email, { timeout: 5_000 });
      if ((await campoSenha.inputValue({ timeout: 5_000 })) !== senha) await campoSenha.fill(senha, { timeout: 5_000 });
      await page.locator("form").getByRole("button", { name: /^entrar$/i }).click({ timeout: 5_000 });
      await page.waitForURL(/verificar-codigo|\/dashboard/, { timeout: 15_000 });
    }).toPass({ timeout: 50_000 });
    await page.goto("/dashboard/conta/seguranca");

    const preencher = async () => {
      await page.locator('input[autocomplete="current-password"]').fill(senha);
      const novas = page.locator('input[autocomplete="new-password"]');
      await novas.nth(0).fill(senhaNova);
      await novas.nth(1).fill(senhaNova);
    };
    await preencher();
    await page.getByRole("button", { name: "Salvar nova senha" }).click();
    // Pede o código e NÃO troca.
    await expect(page.getByText("Confirme o código do seu autenticador para alterar a senha.")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Senha atualizada com sucesso.")).toHaveCount(0);
    expect(await senhaFunciona(senha)).toBe(true);
    expect(await senhaFunciona(senhaNova)).toBe(false);

    // Código errado: recusa e continua sem trocar.
    await page.getByPlaceholder("000000").fill("000000");
    await page.getByRole("button", { name: "Salvar nova senha" }).click();
    await expect(page.getByText("Senha atualizada com sucesso.")).toHaveCount(0);
    expect(await senhaFunciona(senhaNova)).toBe(false);

    // Código certo: salva e a senha nova passa a valer. Espera a próxima janela de 30 s para não reaproveitar o código da ativação.
    const janela = Math.floor(Date.now() / 30000);
    await page.waitForFunction((c) => Math.floor(Date.now() / 30000) > c, janela, { timeout: 35000 });
    await page.getByPlaceholder("000000").fill(gerarCodigoTotp(chave));
    await page.getByRole("button", { name: "Salvar nova senha" }).click();
    await expect(page.getByText("Senha atualizada com sucesso.")).toBeVisible({ timeout: 15000 });
    expect(await senhaFunciona(senhaNova)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await ctx.close();
  });
});
