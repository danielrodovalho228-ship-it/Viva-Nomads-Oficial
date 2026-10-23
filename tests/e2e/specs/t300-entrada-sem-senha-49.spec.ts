import { test, expect, devices, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarAdmin, criarConta, liberarLimiteCodigo, liberarLimiteLogin, liberarLimiteLoginIp, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T300 — Prompt 49: entrada sem senha (e-mail + código), intenção como camada e convidado sem conta.
 * No laboratório a rota /api/auth/codigo não envia e-mail (INTEGRACOES_SIMULADAS): a conta nova nasce pelo cliente de
 * serviço e o código vem do Supabase local (admin.generateLink → email_otp), o mesmo que o e-mail traria.
 *   1. conta nova por código → intenção "Tenho imóvel" → painel no modo proprietário, papel intacto (390 e 1280);
 *   2. código em conta existente (intenção já respondida) → direto ao destino;
 *   3. "Entrar com senha" (terciário) continua entrando;
 *   4. admin entrando só com código não abre /admin (AAL2);
 *   5. convidado favorita 2 imóveis, cria conta no momento de valor e encontra os 2 na conta;
 *   6. app simulado entra por código sem sair do WebView.
 */
const SAIDA = "tests/laboratorio/saida";
const UA_APP = `${devices["iPhone 14"].userAgent} VivaNomadsApp/1.0.4 (expo)`;

async function codigoDe(email: string): Promise<string> {
  const { data, error } = await adm().auth.admin.generateLink({ type: "magiclink", email });
  expect(error, error?.message).toBeNull();
  const otp = data?.properties?.email_otp;
  expect(otp).toMatch(/^\d{6}$/);
  return otp as string;
}

/** Entrada única: e-mail → Continuar → código → Entrar. `url` pode trazer ?motivo e ?redirect. */
async function entrarPorCodigo(page: Page, email: string, url = "/auth"): Promise<void> {
  await liberarLimiteCodigo();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const tela = page.getByTestId("login-por-codigo");
  // 1ª carga fria: um clique antes da hidratação recarrega a página; repete até o campo do código abrir.
  await expect(async () => {
    if (await page.getByTestId("campo-codigo").isVisible()) return;
    const campo = tela.getByPlaceholder("E-mail");
    if ((await campo.inputValue({ timeout: 4_000 })) !== email) await campo.fill(email, { timeout: 4_000 });
    await tela.getByRole("button", { name: "Continuar" }).click({ timeout: 4_000 });
    await expect(page.getByTestId("campo-codigo")).toBeVisible({ timeout: 8_000 });
  }).toPass({ timeout: 45_000 });
  await page.getByTestId("campo-codigo").fill(await codigoDe(email));
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

async function perfil(email: string) {
  const { data: u } = await adm().auth.admin.listUsers({ page: 1, perPage: 1000 });
  const id = u.users.find((x) => x.email === email)?.id;
  expect(id, `conta ${email}`).toBeTruthy();
  const { data } = await adm().from("profiles").select("id, role, intencao, preferred_mode").eq("id", id!).single();
  return data as { id: string; role: string; intencao: string[] | null; preferred_mode: string | null };
}

test.describe("T300 — entrada sem senha, intenção e convidado (Prompt 49)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.use({ storageState: { cookies: [], origins: [] }, actionTimeout: 15_000, navigationTimeout: 30_000 });
  const criadas: string[] = [];
  test.afterAll(async () => {
    await apagarContas(criadas);
  });

  for (const [nome, largura, altura] of [
    ["390", 390, 844],
    ["1280", 1280, 800],
  ] as const) {
    test(`1. conta nova por código → intenção → painel certo (${nome} px)`, async ({ page }) => {
      test.setTimeout(150_000);
      await page.setViewportSize({ width: largura, height: altura });
      const email = `nova.t300.${nome}.${novoSufixo()}@lab.vivanomads.test`;
      await entrarPorCodigo(page, email);
      await page.waitForURL(/\/auth\/intencao/, { timeout: 45_000 });
      criadas.push((await perfil(email)).id);
      const tela = page.getByTestId("tela-intencao");
      await expect(tela.getByRole("heading", { name: "O que você quer fazer na Viva?" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `${SAIDA}/t300-intencao-${nome}.png`, fullPage: true });
      await tela.getByTestId("intencao-anunciar").click();
      await expect(tela.getByTestId("intencao-anunciar")).toHaveAttribute("aria-pressed", "true");
      await tela.getByTestId("intencao-continuar").click();
      await page.waitForURL((u) => u.pathname === "/dashboard", { timeout: 30_000 });
      // Intenção é camada: grava a escolha e o modo do painel; o papel continua o mesmo.
      const p = await perfil(email);
      expect(p.intencao).toEqual(["anunciar"]);
      expect(p.preferred_mode).toBe("owner");
      expect(p.role).toBe("tenant");
      // Nenhuma conta nova cria senha.
      const { data } = await adm().auth.admin.getUserById(p.id);
      expect((data.user?.identities ?? []).every((i) => i.provider === "email")).toBe(true);
      await page.screenshot({ path: `${SAIDA}/t300-painel-${nome}.png` });
    });
  }

  test("2. código em conta existente (intenção respondida) vai direto ao destino", async ({ page }) => {
    test.setTimeout(120_000);
    const email = `existente.t300.${novoSufixo()}@lab.vivanomads.test`;
    const id = await criarConta({ email, nome: "Edu Existente", role: "tenant" }, novaSenha());
    criadas.push(id);
    await adm().from("profiles").update({ intencao: ["morar"] }).eq("id", id);
    await entrarPorCodigo(page, email, "/auth?redirect=%2Fdashboard%2Fconta");
    await page.waitForURL((u) => u.pathname === "/dashboard/conta", { timeout: 45_000 });
    // A intenção aparece editável no Perfil.
    await expect(page.getByTestId("minha-intencao").getByTestId("intencao-morar")).toHaveAttribute("aria-pressed", "true", { timeout: 20_000 });
  });

  test("3. 'Entrar com senha' (terciário) continua entrando", async ({ page }) => {
    test.setTimeout(90_000);
    const email = `senha.t300.${novoSufixo()}@lab.vivanomads.test`;
    const senha = novaSenha();
    criadas.push(await criarConta({ email, nome: "Sara Senha", role: "tenant" }, senha));
    await liberarLimiteLogin(email);
    await liberarLimiteLoginIp();
    await page.goto("/auth", { waitUntil: "domcontentloaded" });
    await expect(async () => {
      if (!(await page.getByTestId("login-com-senha").isVisible())) await page.getByTestId("entrar-com-senha").click({ timeout: 4_000 });
      await expect(page.getByTestId("login-com-senha")).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(senha);
    await page.locator("form").getByRole("button", { name: /^entrar$/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  });

  test("4. admin entrando só com código não abre /admin (exige AAL2)", async ({ page }) => {
    test.setTimeout(120_000);
    const email = `admin.t300.${novoSufixo()}@lab.vivanomads.test`;
    const id = await criarAdmin(email, "Ada Admin", novaSenha());
    criadas.push(id);
    await adm().from("profiles").update({ intencao: [] }).eq("id", id);
    await entrarPorCodigo(page, email);
    await page.waitForURL((u) => !u.pathname.startsWith("/auth") || u.pathname === "/auth/intencao", { timeout: 45_000 });
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/auth\/verificar-codigo|2fa/);
    expect(new URL(page.url()).pathname).not.toBe("/admin");
  });

  test("5. convidado favorita 2, cria conta no momento de valor e encontra os 2", async ({ page }) => {
    test.setTimeout(180_000);
    const { data: imoveis } = await adm().from("properties").select("id").eq("status", "active").limit(2);
    expect(imoveis?.length).toBe(2);
    for (const im of imoveis!) {
      await page.goto(`/imoveis/${im.id}`, { waitUntil: "domcontentloaded" });
      const coracao = page.getByTestId("coracao").first();
      await expect(async () => {
        if ((await coracao.getAttribute("aria-pressed")) !== "true") await coracao.click({ timeout: 4_000 });
        await expect(coracao).toHaveAttribute("aria-pressed", "true", { timeout: 3_000 });
      }).toPass({ timeout: 30_000 });
    }
    const locais = await page.evaluate(() => (JSON.parse(localStorage.getItem("vivanomads-favorites") ?? "{}").state?.ids ?? []) as string[]);
    expect(locais).toHaveLength(2);
    // Momento de valor: a entrada diz o porquê e volta para a ação.
    const email = `convidado.t300.${novoSufixo()}@lab.vivanomads.test`;
    await page.goto(`/auth?motivo=pedido&redirect=${encodeURIComponent("/dashboard/favoritos")}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("entrada-motivo")).toHaveText("Para enviar seu pedido, entre com seu e-mail.");
    await entrarPorCodigo(page, email, `/auth?motivo=pedido&redirect=${encodeURIComponent("/dashboard/favoritos")}`);
    await page.waitForURL(/\/auth\/intencao/, { timeout: 45_000 });
    const p = await perfil(email);
    criadas.push(p.id);
    await page.getByTestId("intencao-agora-nao").click();
    await page.waitForURL((u) => u.pathname === "/dashboard/favoritos", { timeout: 30_000 });
    // Mesclou na conta, sem duplicar, e a cópia do aparelho passou a ser a da conta (nada pendente).
    await expect
      .poll(async () => ((await adm().from("favorites").select("property_id").eq("tenant_id", p.id)).data ?? []).map((r) => r.property_id).sort(), { timeout: 30_000 })
      .toEqual([...locais].sort());
    const estado = await page.evaluate(() => JSON.parse(localStorage.getItem("vivanomads-favorites") ?? "{}").state);
    expect(estado.pendente).toEqual([]);
    expect([...estado.ids].sort()).toEqual([...locais].sort());
    expect((await perfil(email)).intencao).toEqual([]);
  });

  test("6. app simulado entra por código sem trocar de navegador", async ({ browser }) => {
    test.setTimeout(120_000);
    const email = `app.t300.${novoSufixo()}@lab.vivanomads.test`;
    const id = await criarConta({ email, nome: "Alice App", role: "tenant" }, novaSenha());
    criadas.push(id);
    await adm().from("profiles").update({ intencao: ["morar"] }).eq("id", id);
    const ctx = await browser.newContext({ ...devices["iPhone 13"], userAgent: UA_APP });
    const page = await ctx.newPage();
    let abriuOutraJanela = false;
    ctx.on("page", (p) => {
      if (p !== page) abriuOutraJanela = true;
    });
    await entrarPorCodigo(page, email);
    await page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 45_000 });
    expect(abriuOutraJanela).toBe(false);
    await page.screenshot({ path: `${SAIDA}/t300-app-entrou.png` });
    await ctx.close();
  });
});
