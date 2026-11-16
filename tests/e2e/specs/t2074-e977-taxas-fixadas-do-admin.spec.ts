import { test, expect, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { gerarCodigoTotp } from "../fixtures/totp";
import { CHAVE_ANON, NO_LABORATORIO, URL_SUPABASE, adm, apagarContas, criarAdmin, criarConta, entrar, liberarLimiteLogin, liberarLimiteLoginIp, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2074 — E977 (Pista 3; autorizado pelo Gerente na ronda 03:49Z) @E977 — sem @ao-vivo-seguro: precisa de sessão de
  admin com 2FA e do laboratório (VERMELHO PENDENTE DE LABORATÓRIO: só corre com INTEGRACOES_SIMULADAS=on e a chave).
  Regra decidida (E977, Família 8; tela no draft #3890): a taxa fixada pelo admin deixa de ser só por SQL — em
  /admin/taxas-fixadas o admin registra e-mail do proprietário, taxa em %, motivo e "vale até":
    1. registrar grava UMA linha em comissao_fixada_admin (taxa, motivo, validade no fim do dia em Brasília,
       criado_por = o admin) e o histórico mostra "Vale agora";
    2. registrar outra para o mesmo dono NÃO apaga nem edita a anterior: a nova "Vale agora" e a antiga fica
       "Substituída por uma mais recente" (a regra da cobrança: vale a mais recente dentro da validade);
    3. taxa fora de 0–100 é recusada e nada é gravado;
    4. quem não é admin não registra nada (a tela não abre o formulário).
  A 1280 px (tela de equipe); o formulário a 390 px também é conferido no passo 1.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const admin = { email: `admin.t2074.${sufixo}@lab.vivanomads.test`, nome: "Ada Taxa" };
const dono = { email: `dono.t2074.${sufixo}@lab.vivanomads.test`, nome: "Davi Taxa Fixa", role: "owner" as const };
const ids: Record<string, string> = {};
let segredoTotp = "";

async function entrarAdmin(browser: Browser, largura: number): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: largura, height: 900 } });
  const page = await ctx.newPage();
  await liberarLimiteLogin(admin.email);
  await liberarLimiteLoginIp();
  await page.goto("/auth?senha=1", { waitUntil: "domcontentloaded" });
  const campoEmail = page.locator('input[name="email"], input[type="email"]').first();
  const campoSenha = page.locator('input[name="password"], input[type="password"]').first();
  await expect(async () => {
    if (/verificar-codigo|\/dashboard|\/admin/.test(page.url())) return;
    if ((await campoEmail.inputValue({ timeout: 5_000 })) !== admin.email) await campoEmail.fill(admin.email, { timeout: 5_000 });
    if ((await campoSenha.inputValue({ timeout: 5_000 })) !== senha) await campoSenha.fill(senha, { timeout: 5_000 });
    await page.locator("form").getByRole("button", { name: /^entrar$/i }).click({ timeout: 5_000 });
    await page.waitForURL(/verificar-codigo|\/dashboard|\/admin/, { timeout: 15_000 });
  }).toPass({ timeout: 50_000 });
  await page.goto("/admin/taxas-fixadas", { waitUntil: "domcontentloaded" });
  if (/verificar-codigo/.test(page.url())) {
    await page.locator("#codigo-2fa").fill(gerarCodigoTotp(segredoTotp));
    await page.getByRole("button", { name: /confirmar e entrar/i }).click();
    await page.waitForURL(/\/admin(?!.*verificar)/, { timeout: 30_000 });
    await page.goto("/admin/taxas-fixadas", { waitUntil: "domcontentloaded" });
  }
  return page;
}

async function registrar(page: Page, taxa: string, validade: string, motivo: string) {
  const form = page.getByTestId("taxa-fixada-form");
  await expect(form).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("taxa-fixada-email").fill(dono.email);
  await page.getByTestId("taxa-fixada-taxa").fill(taxa);
  await page.getByTestId("taxa-fixada-validade").fill(validade);
  await page.getByTestId("taxa-fixada-motivo").fill(motivo);
  await page.getByTestId("taxa-fixada-registrar").click();
}

const linhasDoDono = async () =>
  ((await adm().from("comissao_fixada_admin").select("id, taxa, motivo, valido_ate, criado_por, criado_em").eq("owner_id", ids.dono).order("criado_em")).data ?? []) as {
    id: string; taxa: number; motivo: string; valido_ate: string; criado_por: string;
  }[];

test.describe("T2074 — E977: a tela do admin registra a taxa fixada @E977", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (admin com 2FA e chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.admin = await criarAdmin(admin.email, admin.nome, senha);
    const c = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
    const { error: eLogin } = await c.auth.signInWithPassword({ email: admin.email, password: senha });
    if (eLogin) throw eLogin;
    const { data: fator, error: eEnroll } = await c.auth.mfa.enroll({ factorType: "totp", friendlyName: "t2074" });
    if (eEnroll) throw eEnroll;
    segredoTotp = fator!.totp.secret;
    const { data: desafio } = await c.auth.mfa.challenge({ factorId: fator!.id });
    const { error: eVer } = await c.auth.mfa.verify({ factorId: fator!.id, challengeId: desafio!.id, code: gerarCodigoTotp(segredoTotp) });
    if (eVer) throw eVer;
  });
  test.afterAll(async () => {
    await adm().from("comissao_fixada_admin").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.dono, ids.admin]);
  });

  test("390 px — o formulário cabe na tela do celular (e-mail, taxa, validade, motivo, Registrar)", async ({ browser }) => {
    const p = await entrarAdmin(browser, 390);
    for (const t of ["taxa-fixada-email", "taxa-fixada-taxa", "taxa-fixada-validade", "taxa-fixada-motivo", "taxa-fixada-registrar"]) await expect(p.getByTestId(t)).toBeVisible({ timeout: 30_000 });
    expect(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await p.context().close();
  });

  test("1280 px — 1: registrar grava uma linha (taxa, motivo, validade, quem registrou) e o histórico diz Vale agora", async ({ browser }) => {
    const p = await entrarAdmin(browser, 1280);
    await registrar(p, "4,5", "31/12/2027", `Acordo comercial ${sufixo}`);
    await expect(p.getByTestId("taxa-fixada-ok")).toContainText("4,5%", { timeout: 20_000 });
    const l = await linhasDoDono();
    expect(l).toHaveLength(1);
    expect(Number(l[0].taxa)).toBeCloseTo(0.045, 6);
    expect(l[0].motivo).toBe(`Acordo comercial ${sufixo}`);
    expect(l[0].criado_por).toBe(ids.admin);
    // Fim do dia 31/12/2027 em Brasília = 01/01/2028 02:59:59 UTC (ou o primeiro instante depois: até 03:00).
    const fim = new Date(l[0].valido_ate).getTime();
    expect(fim).toBeGreaterThanOrEqual(Date.parse("2028-01-01T02:59:00Z"));
    expect(fim).toBeLessThanOrEqual(Date.parse("2028-01-01T03:00:00Z"));
    await p.reload({ waitUntil: "domcontentloaded" });
    const linha = p.getByTestId("taxa-fixada-linha").filter({ hasText: dono.nome });
    await expect(linha).toHaveCount(1, { timeout: 20_000 });
    await expect(linha).toContainText("Vale agora");
    await p.context().close();
  });

  test("1280 px — 2: uma nova para o mesmo dono não apaga a anterior; a nova vale, a antiga fica substituída", async ({ browser }) => {
    const p = await entrarAdmin(browser, 1280);
    await registrar(p, "3", "30/06/2028", `Renegociação ${sufixo}`);
    await expect(p.getByTestId("taxa-fixada-ok")).toContainText("3%", { timeout: 20_000 });
    const l = await linhasDoDono();
    expect(l, "nada foi apagado: as duas linhas ficam no histórico").toHaveLength(2);
    expect(Number(l[0].taxa), "a anterior não foi editada").toBeCloseTo(0.045, 6);
    await p.reload({ waitUntil: "domcontentloaded" });
    const linhas = p.getByTestId("taxa-fixada-linha").filter({ hasText: dono.nome });
    await expect(linhas).toHaveCount(2, { timeout: 20_000 });
    await expect(linhas.filter({ hasText: "Renegociação" })).toContainText("Vale agora");
    await expect(linhas.filter({ hasText: "Acordo comercial" })).toContainText("Substituída por uma mais recente");
    await p.context().close();
  });

  test("1280 px — 3: taxa fora de 0–100 é recusada e nada é gravado", async ({ browser }) => {
    const p = await entrarAdmin(browser, 1280);
    const antes = (await linhasDoDono()).length;
    await registrar(p, "120", "31/12/2027", `Taxa inválida ${sufixo}`);
    await expect(p.getByTestId("taxa-fixada-erro")).toBeVisible({ timeout: 20_000 });
    expect((await linhasDoDono()).length).toBe(antes);
    await p.context().close();
  });

  test("1280 px — 4: quem não é admin não vê o formulário nem grava nada", async ({ browser }) => {
    const antes = (await linhasDoDono()).length;
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto("/admin/taxas-fixadas", { waitUntil: "domcontentloaded" });
    await p.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await expect(p.getByTestId("taxa-fixada-form")).toHaveCount(0);
    expect((await linhasDoDono()).length).toBe(antes);
    await p.context().close();
  });
});
