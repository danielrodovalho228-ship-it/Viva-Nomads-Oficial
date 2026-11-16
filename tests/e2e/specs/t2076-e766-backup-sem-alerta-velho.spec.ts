import { test, expect, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { gerarCodigoTotp } from "../fixtures/totp";
import { CHAVE_ANON, NO_LABORATORIO, URL_SUPABASE, adm, apagarContas, criarAdmin, liberarLimiteLogin, liberarLimiteLoginIp, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2076 — E766, resíduo (Pista 3; autorizado pelo Gerente na ronda 04:19Z) @E766 — sem @ao-vivo-seguro: precisa de
  admin com 2FA e do laboratório (VERMELHO PENDENTE DE LABORATÓRIO: só corre com INTEGRACOES_SIMULADAS=on e a chave).
  Regra decidida: o painel de backup do admin NÃO mostra alerta velho de "cópia falhou" quando o último backup correu
  bem. Cenário (linhas gravadas em backups_execucoes, as mais recentes do banco):
    1. só a cópia que falhou → o /admin alerta (prova de que a tela lê as linhas: a trava não é vazia);
    2. grava-se uma cópia OK depois dela → /admin: resumo "Em dia", sem "A última cópia falhou", sem a linha
       "alerta de backup" em "Precisa da sua atenção"; /admin/sistema#backup: o cartão verde, sem o porquê.
  O estado puro está no t2075 (unitário). 1280 e 390 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const admin = { email: `admin.t2076.${sufixo}@lab.vivanomads.test`, nome: "Abel Backup" };
const ids: string[] = [];
const linhas: string[] = [];
let segredoTotp = "";
const FALHOU = /A última cópia falhou/;

const atras = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

async function gravar(tipo: "copia" | "drill", minAtras: number, ok: boolean) {
  const { data, error } = await adm()
    .from("backups_execucoes")
    .insert({ tipo, inicio: atras(minAtras + 20), fim: atras(minAtras), ok, motivo: ok ? null : `Falhou: ensaio t2076 ${sufixo}.`, bytes_banco: ok ? 50_000_000 : null, objetos_storage: ok ? 1200 : null, duracao_restauracao_s: tipo === "drill" && ok ? 240 : null })
    .select("id")
    .single();
  if (error) throw error;
  linhas.push(data.id as string);
}

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
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  if (/verificar-codigo/.test(page.url())) {
    await page.locator("#codigo-2fa").fill(gerarCodigoTotp(segredoTotp));
    await page.getByRole("button", { name: /confirmar e entrar/i }).click();
    await page.waitForURL(/\/admin(?!.*verificar)/, { timeout: 30_000 });
  }
  return page;
}

test.describe("T2076 — E766: o painel de backup não mostra alerta velho de cópia falhou @E766", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (admin com 2FA e chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.push(await criarAdmin(admin.email, admin.nome, senha));
    const c = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
    const { error: eLogin } = await c.auth.signInWithPassword({ email: admin.email, password: senha });
    if (eLogin) throw eLogin;
    const { data: fator, error: eEnroll } = await c.auth.mfa.enroll({ factorType: "totp", friendlyName: "t2076" });
    if (eEnroll) throw eEnroll;
    segredoTotp = fator!.totp.secret;
    const { data: desafio } = await c.auth.mfa.challenge({ factorId: fator!.id });
    const { error: eVer } = await c.auth.mfa.verify({ factorId: fator!.id, challengeId: desafio!.id, code: gerarCodigoTotp(segredoTotp) });
    if (eVer) throw eVer;
    // O teste de restauração em dia (não é o assunto aqui) e a cópia que falhou há 10 h.
    await gravar("drill", 60, true);
    await gravar("copia", 600, false);
  });
  test.afterAll(async () => {
    if (linhas.length) await adm().from("backups_execucoes").delete().in("id", linhas);
    await apagarContas(ids);
  });

  test("1280 px — 1: só a falha → o /admin alerta (a tela lê as linhas)", async ({ browser }) => {
    const p = await entrarAdmin(browser, 1280);
    await expect(p.getByTestId("admin-backup-resumo")).toHaveAttribute("data-estado", "vermelho", { timeout: 30_000 });
    await expect(p.getByTestId("admin-backup-porque-copia")).toHaveText(FALHOU);
    await p.context().close();
  });

  test("2: depois da falha, uma cópia OK — nenhuma superfície mostra o alerta velho", async ({ browser }) => {
    await gravar("copia", 30, true);
    for (const largura of [1280, 390]) {
      const p = await entrarAdmin(browser, largura);
      // /admin: o resumo e "Precisa da sua atenção".
      const resumo = p.getByTestId("admin-backup-resumo");
      await expect(resumo).toHaveAttribute("data-estado", "verde", { timeout: 30_000 });
      await expect(p.getByTestId("admin-backup-estado")).toHaveText("Em dia");
      await expect(p.getByTestId("admin-backup-porque-copia")).toHaveCount(0);
      await expect(p.locator('[data-testid="admin-atencao-item"][data-chave="backup"]')).toHaveCount(0);
      expect((await p.locator("main").innerText()).match(FALHOU)?.[0] ?? null, `/admin a ${largura} px`).toBeNull();
      // /admin/sistema#backup: o cartão completo.
      await p.goto("/admin/sistema#backup", { waitUntil: "domcontentloaded" });
      const cartao = p.getByTestId("cartao-backup");
      await expect(cartao).toHaveAttribute("data-estado", "verde", { timeout: 30_000 });
      await expect(p.getByTestId("backup-copia-porque")).toHaveCount(0);
      expect((await p.locator("main").innerText()).match(FALHOU)?.[0] ?? null, `/admin/sistema a ${largura} px`).toBeNull();
      await p.context().close();
    }
  });
});
