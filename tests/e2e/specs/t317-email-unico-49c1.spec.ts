import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, lerSaida, liberarLimiteCodigo, novoSufixo } from "../fixtures/laboratorio";

/**
 * T317 — 49-C1: cadastro com UM e-mail só (código), sem tela órfã e validade igual na tela e no e-mail.
 * No laboratório a rota /api/auth/codigo grava no LAB_OUTBOX o MESMO e-mail que o Supabase mandaria (modelo "Confirm
 * signup" para conta nova, "Magic link" para a existente), com o código no lugar de {{ .Token }}.
 *   1. conta nova pede o código → exatamente 1 e-mail, com código e sem link → "10 minutos" igual na tela e no e-mail →
 *      digita o código do e-mail → entra → intenção;
 *   2. conta existente → 1 e-mail com código → entra direto;
 *   3. outra aba entra por um link antigo (/auth/confirm) → a 1ª aba sai sozinha da tela do código; o link antigo cai
 *      na intenção;
 *   4. /admin mostra o cartão "Entrada por e-mail" (no laboratório, sem leitura do GitHub).
 */
const SAIDA = "tests/laboratorio/saida";

async function emailsPara(email: string) {
  return (await lerSaida()).filter((l) => l.servico === "email" && l.para === email) as { assunto?: string; corpo?: string }[];
}

async function pedirCodigo(page: Page, email: string): Promise<void> {
  await liberarLimiteCodigo();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  const tela = page.getByTestId("login-por-codigo");
  // 1ª carga fria: um clique antes da hidratação recarrega a página; repete até o campo do código abrir.
  await expect(async () => {
    if (await page.getByTestId("campo-codigo").isVisible()) return;
    const campo = tela.getByPlaceholder("E-mail");
    if ((await campo.inputValue({ timeout: 4_000 })) !== email) await campo.fill(email, { timeout: 4_000 });
    await tela.getByRole("button", { name: "Continuar" }).click({ timeout: 4_000 });
    await expect(page.getByTestId("campo-codigo")).toBeVisible({ timeout: 8_000 });
  }).toPass({ timeout: 45_000 });
}

/** O e-mail que chegou: um só, com o código de 6 dígitos, sem link de entrada, com a validade da tela. */
async function umEmailComCodigo(email: string, antes = 0): Promise<{ codigo: string; corpo: string; assunto: string }> {
  await expect.poll(async () => (await emailsPara(email)).length, { timeout: 20_000 }).toBe(antes + 1);
  const e = (await emailsPara(email))[antes];
  const corpo = e.corpo ?? "";
  const codigo = corpo.match(/Seu código: (\d{6})/)?.[1] ?? "";
  expect(codigo, "o e-mail traz o código").toMatch(/^\d{6}$/);
  expect(corpo).not.toMatch(/\/auth\/(confirm|callback)|token_hash|\{\{/);
  expect(corpo).toContain("10 minutos");
  return { codigo, corpo, assunto: e.assunto ?? "" };
}

async function idDe(email: string): Promise<string> {
  const { data } = await adm().auth.admin.listUsers({ page: 1, perPage: 1000 });
  const id = data.users.find((u) => u.email === email)?.id;
  expect(id, `conta ${email}`).toBeTruthy();
  return id!;
}

test.describe("T317 — e-mail único com código (49-C1)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ storageState: { cookies: [], origins: [] }, actionTimeout: 15_000, navigationTimeout: 30_000 });
  const email = `unico.t317.${novoSufixo()}@lab.vivanomads.test`;
  const outra = `aba.t317.${novoSufixo()}@lab.vivanomads.test`;
  const criadas: string[] = [];

  test.afterAll(async () => {
    await apagarContas(criadas);
  });

  test("1. conta nova: 1 e-mail com código e sem link, 10 minutos na tela e no e-mail, entra e vê a intenção (390)", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await pedirCodigo(page, email);
    await expect(page.getByTestId("login-por-codigo")).toContainText("Ele vale por 10 minutos.");
    const { codigo, assunto } = await umEmailComCodigo(email);
    expect(assunto).toContain("Seu código de acesso");
    await page.screenshot({ path: `${SAIDA}/t317-digite-o-codigo-390.png`, fullPage: true });
    await page.getByTestId("campo-codigo").fill(codigo);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL(/\/auth\/intencao/, { timeout: 45_000 });
    criadas.push(await idDe(email));
    await page.getByTestId("tela-intencao").getByTestId("intencao-morar").click();
    await page.getByTestId("tela-intencao").getByTestId("intencao-continuar").click();
    await page.waitForURL((u) => u.pathname === "/dashboard", { timeout: 30_000 });
    // Nenhum e-mail a mais depois de entrar.
    await page.waitForTimeout(3_000);
    expect((await emailsPara(email)).length).toBe(1);
  });

  test("2. conta existente: 1 e-mail com código, entra direto (1280)", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    const antes = (await emailsPara(email)).length;
    await pedirCodigo(page, email);
    const { codigo } = await umEmailComCodigo(email, antes);
    await page.getByTestId("campo-codigo").fill(codigo);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL((u) => u.pathname === "/dashboard", { timeout: 45_000 });
    expect((await emailsPara(email)).length).toBe(antes + 1);
  });

  test("3. entrou por outra aba (link antigo): a 1ª aba sai sozinha da tela do código, sem pedir código", async ({ browser }) => {
    test.setTimeout(150_000);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const aba1 = await ctx.newPage();
    await pedirCodigo(aba1, outra);
    await umEmailComCodigo(outra);
    criadas.push(await idDe(outra));

    // Outra aba abre um link antigo de entrada (o tipo de e-mail que a produção ainda mandava antes do 49-C1).
    const { data, error } = await adm().auth.admin.generateLink({ type: "magiclink", email: outra });
    expect(error, error?.message).toBeNull();
    const hash = data!.properties!.hashed_token;
    const aba2 = await ctx.newPage();
    // O type do link tem de ser o do token gerado (magiclink); verifyOtp com outro type recusa → /auth?erro=confirmacao.
    await aba2.goto(`/auth/confirm?token_hash=${hash}&type=magiclink&next=/dashboard`, { waitUntil: "domcontentloaded" });
    // O link antigo continua valendo e cai no destino da entrada por código: a intenção da conta nova.
    await aba2.waitForURL(/\/auth\/(intencao|pronto)/, { timeout: 30_000 });

    // A 1ª aba percebe a sessão e segue sozinha, sem pedir código nem mandar outro e-mail.
    // O aviso "Você já entrou. Continuando…" aparece só no instante da troca: a aba pode já ter seguido quando o teste
    // olha (lab de 23/10). O que vale é a 1ª aba sair sozinha da tela do código, sem pedir código nem mandar e-mail.
    await expect(aba1.getByTestId("ja-entrou").or(aba1.getByTestId("tela-intencao"))).toBeVisible({ timeout: 30_000 });
    await aba1.waitForURL(/\/auth\/intencao|\/dashboard/, { timeout: 30_000 });
    await expect(aba1.getByTestId("campo-codigo")).toHaveCount(0);
    expect((await emailsPara(outra)).length).toBe(1);
    await ctx.close();
  });

  test("4. /admin: cartão 'Entrada por e-mail' com a validade da constante", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    await p.goto("/admin", { waitUntil: "domcontentloaded" });
    const cartao = p.getByTestId("admin-entrada-email");
    await expect(cartao).toBeVisible({ timeout: 20_000 });
    await expect(cartao).toContainText("10 minutos");
    // No laboratório o cartão não chama o GitHub.
    await expect(cartao).toHaveAttribute("data-estado", "sem_leitura");
    await cartao.screenshot({ path: `${SAIDA}/t317-cartao-admin-1280.png` });
    await ctx.close();
  });
});
