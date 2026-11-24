import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { gerarCodigoTotp } from "../fixtures/totp";
import { CHAVE_ANON, NO_LABORATORIO, URL_SUPABASE, apagarContas, criarAdmin, liberarLimiteLogin, liberarLimiteLoginIp, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1606 — E788 (reprova da prova ao vivo de 11/11): no topo do admin o "Equipe" era inerte (sem clique; depois sem círculo)
  e a mesma conta aparecia com iniciais diferentes por superfície ("c" no cabeçalho × "CQ" no Perfil × "C" no rodapé).
   • o selo "Equipe" do topo tem o avatar e ABRE o menu da Conta: Minha conta · Ajuda · Sair; "Minha conta" leva à Conta;
   • as iniciais do topo, do rodapé da barra lateral e do Perfil são as mesmas (maiúsculas), a 1280 e a 390 px.
*/
// Conta própria (nome conhecido): "Camila Quintela" → "CQ" em toda superfície; a marca de teste não entra nas iniciais.
const senha = novaSenha();
const sufixo = novoSufixo();
const email = `equipe.t1606.${sufixo}@lab.vivanomads.test`;
let id: string | undefined;
let segredo = "";

/** Login por senha e o código do autenticador (o admin exige duas etapas), como a t650. */
async function entrarAdmin(page: Page) {
  await liberarLimiteLogin(email);
  await liberarLimiteLoginIp();
  await page.goto("/auth?senha=1", { waitUntil: "domcontentloaded" });
  const campoEmail = page.locator('input[name="email"], input[type="email"]').first();
  const campoSenha = page.locator('input[name="password"], input[type="password"]').first();
  await expect(async () => {
    if (/verificar-codigo|\/dashboard|\/admin/.test(page.url())) return;
    if ((await campoEmail.inputValue({ timeout: 5_000 })) !== email) await campoEmail.fill(email, { timeout: 5_000 });
    if ((await campoSenha.inputValue({ timeout: 5_000 })) !== senha) await campoSenha.fill(senha, { timeout: 5_000 });
    await page.locator("form").getByRole("button", { name: /^entrar$/i }).click({ timeout: 5_000 });
    await page.waitForURL(/verificar-codigo|\/dashboard|\/admin/, { timeout: 15_000 });
  }).toPass({ timeout: 50_000 });
  await page.evaluate(() => localStorage.setItem("vivanomads-role-asked", "1"));
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  if (/verificar-codigo/.test(page.url())) {
    await page.locator("#codigo-2fa").fill(gerarCodigoTotp(segredo));
    await page.getByRole("button", { name: /confirmar e entrar/i }).click();
    await page.waitForURL(/\/admin(?!.*verificar)/, { timeout: 30_000 });
  }
}

async function letras(p: Page, seletor: string) {
  const el = p.locator(`${seletor} [data-rosto]`).first();
  await expect(el).toBeAttached({ timeout: 20_000 });
  return ((await el.textContent()) ?? "").trim();
}

test.describe("T1606 — E788 avatar da equipe funcional e iniciais iguais", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.beforeAll(async () => {
    id = await criarAdmin(email, "[TESTE QA] Camila Quintela", senha);
    const c = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
    const { error: eLogin } = await c.auth.signInWithPassword({ email, password: senha });
    if (eLogin) throw eLogin;
    const { data: fator, error: eEnroll } = await c.auth.mfa.enroll({ factorType: "totp", friendlyName: "t1606" });
    if (eEnroll) throw eEnroll;
    segredo = fator!.totp.secret;
    const { data: desafio } = await c.auth.mfa.challenge({ factorId: fator!.id });
    const { error: eVer } = await c.auth.mfa.verify({ factorId: fator!.id, challengeId: desafio!.id, code: gerarCodigoTotp(segredo) });
    if (eVer) throw eVer;
  });
  test.afterAll(async () => {
    await apagarContas([id]);
  });

  for (const largura of [1280, 390]) {
    test(`${largura}px — o selo Equipe abre o menu da Conta; iniciais iguais no topo, no rodapé e no Perfil`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await entrarAdmin(page);

      const selo = page.locator('[data-testid="papel-ativo"][data-papel="admin"]:visible');
      await expect(selo).toBeVisible({ timeout: 30_000 });
      await expect(selo).toContainText("Equipe");
      const doTopo = await letras(page, '[data-testid="papel-ativo"][data-papel="admin"]:visible');
      expect(doTopo).toBe("CQ");

      // O avatar funciona: abre o menu com os três itens; Esc fecha.
      const botao = selo.getByTestId("conta-equipe");
      await botao.click();
      const menu = page.getByTestId("menu-conta-equipe");
      await expect(menu).toBeVisible();
      await expect(menu.getByRole("menuitem")).toHaveText(["Minha conta", "Ajuda", "Sair"]);
      await page.keyboard.press("Escape");
      await expect(menu).toHaveCount(0);

      // O rodapé da barra lateral (no celular, dentro da gaveta) tem as mesmas iniciais.
      if (largura === 390) await page.getByTestId("admin-abrir-menu").click();
      expect(await letras(page, '[data-testid="barra-avatar"]:visible')).toBe(doTopo);
      if (largura === 390) await page.keyboard.press("Escape");

      // "Minha conta" leva à Conta, e o Perfil mostra as mesmas iniciais.
      if (largura === 390) await page.goto("/admin", { waitUntil: "domcontentloaded" });
      await page.locator('[data-testid="papel-ativo"][data-papel="admin"]:visible').getByTestId("conta-equipe").click();
      await page.getByTestId("conta-equipe-conta").click();
      await expect(page).toHaveURL(/\/dashboard\/conta/, { timeout: 30_000 });
      // A Conta ainda pode estar redirecionando (net::ERR_ABORTED no goto): repete até o Perfil abrir.
      await expect(async () => {
        await page.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
        await expect(page).toHaveURL(/\/dashboard\/conta\/perfil/);
      }).toPass({ timeout: 30_000 });
      expect(await letras(page, "main")).toBe(doTopo);
    });
  }
});
