import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, liberarLimiteCodigo, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T203 — ordem d250ea2f, item 4 (achado do Moacir sobre o #734): "Entrar com código" de ponta a ponta.
 * O t170 só confere que a opção abre. Aqui: pedir o código, digitar o código REAL e entrar; código errado;
 * 5 erros travam a tela; reenvio só depois de 60 s.
 *
 * O laboratório não tem caixa de e-mail (mailpit desligado): com INTEGRACOES_SIMULADAS a rota /api/auth/codigo não
 * envia nada, e o código vem do próprio Supabase local (admin.generateLink → email_otp), o mesmo que o e-mail traria.
 * Prompt 49: /auth já abre na entrada única (e-mail + "Continuar").
 */
test.describe("T203 — Entrar com código por e-mail: de ponta a ponta", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ viewport: { width: 390, height: 844 }, actionTimeout: 15_000, navigationTimeout: 30_000 });

  const senha = novaSenha();
  const sufixo = novoSufixo();
  const conta = { email: `codigo.t203.${sufixo}@lab.vivanomads.test`, nome: "Cora Codigo", role: "tenant" as const };
  let contaId: string | undefined;

  test.beforeAll(async () => {
    contaId = await criarConta(conta, senha);
  });

  test.afterAll(async () => {
    await apagarContas([contaId]);
  });

  /** Abre /auth (entrada única) → e-mail → "Continuar" e deixa o campo do código à vista. */
  async function pedirCodigo(page: Page) {
    await liberarLimiteCodigo();
    await page.goto("/auth", { waitUntil: "domcontentloaded" });
    const tela = page.getByTestId("login-por-codigo");
    // Na 1ª carga fria o clique pode chegar antes da hidratação (envio nativo recarrega /auth): repete até o código abrir.
    await expect(async () => {
      if (await page.getByTestId("campo-codigo").isVisible()) return;
      const campo = tela.getByPlaceholder("E-mail");
      if ((await campo.inputValue({ timeout: 4_000 })) !== conta.email) await campo.fill(conta.email, { timeout: 4_000 });
      await tela.getByRole("button", { name: "Continuar" }).click({ timeout: 4_000 });
      await expect(page.getByTestId("campo-codigo")).toBeVisible({ timeout: 8_000 });
    }).toPass({ timeout: 45_000 });
  }

  async function codigoReal(): Promise<string> {
    const { data, error } = await adm().auth.admin.generateLink({ type: "magiclink", email: conta.email });
    expect(error, error?.message).toBeNull();
    const otp = data?.properties?.email_otp;
    expect(otp).toMatch(/^\d{6}$/);
    return otp as string;
  }

  test("código errado: mensagem clara, sem entrar; 5 erros travam o botão", async ({ page }) => {
    test.setTimeout(120_000);
    await pedirCodigo(page);
    // Um código de verdade existe para a conta, então o "errado" é de fato errado (não é o gerado).
    const certo = await codigoReal();
    const errado = certo === "000000" ? "111111" : "000000";
    const entrar = page.getByRole("button", { name: "Entrar", exact: true });
    for (let i = 1; i <= 5; i++) {
      await page.getByTestId("campo-codigo").fill(errado);
      await entrar.click();
      await expect(page.getByText("Código incorreto ou vencido")).toBeVisible({ timeout: 15_000 });
      expect(new URL(page.url()).pathname).toBe("/auth");
    }
    // Depois de 5 erros a tela trava até pedir um novo código, mesmo com o código certo digitado.
    await page.getByTestId("campo-codigo").fill(certo);
    await expect(entrar).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });

  test("reenvio só depois de 60 s", async ({ page }) => {
    test.setTimeout(90_000);
    await page.clock.install();
    await pedirCodigo(page);
    const reenviar = page.getByRole("button", { name: /Reenviar código/ });
    await expect(reenviar).toBeDisabled();
    await expect(reenviar).toContainText("Reenviar código em");
    await page.clock.fastForward(61_000);
    await expect(reenviar).toBeEnabled({ timeout: 10_000 });
    await expect(reenviar).toHaveText("Reenviar código");
  });

  test("código certo: entra e sai da tela de login", async ({ page }) => {
    test.setTimeout(120_000);
    await pedirCodigo(page);
    await page.getByTestId("campo-codigo").fill(await codigoReal());
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    // Conta criada agora no laboratório conta como "nova": pode passar pela tela de intenção (Prompt 49).
    await page.waitForURL((u) => !u.pathname.startsWith("/auth") || u.pathname === "/auth/intencao", { timeout: 45_000 });
    // Sessão de verdade: uma área logada abre sem voltar ao login.
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/\/auth/);
    await page.screenshot({ path: "test-results/t203-entrou-390.png" });
  });
});
