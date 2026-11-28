import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, liberarLimiteLogin, liberarLimiteLoginIp, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1678 — E1002 (Gerente, 17/11/2026): a âncora do link sobrevive ao login.
  Quem abre, sem sessão, um link do painel que termina em "#seção" é mandado ao login. O destino guardado é caminho +
  consulta (F11); a âncora não chega ao servidor, e a tela do login a ignorava: depois de entrar, a pessoa caía no começo
  da página, ou, no link antigo da Conta (/dashboard/conta#documento, E798), no Perfil ou no menu, e não em
  Dados › Documento. A tela do login passa a juntar a âncora que o navegador manteve ao destino.

  Caminho de quem usa: abre o link, cai no login, escolhe "Entrar com senha", entra. Sem preparar cookie nem endereço.
  Só no laboratório (cria a própria conta).
*/
const CASOS = [
  { chave: "link-novo", nome: "link novo, Dados › Documento", abre: "/dashboard/conta/dados#documento", guardado: "/dashboard/conta/dados", chega: "/dashboard/conta/dados#documento" },
  // O link antigo da Conta: logada, a pessoa vai a Dados › Documento (E798, destinoDaAncora). Pelo login tem de dar no mesmo.
  { chave: "link-antigo", nome: "link antigo da Conta (E798)", abre: "/dashboard/conta#documento", guardado: "/dashboard/conta", chega: "/dashboard/conta/dados#documento" },
  // Sem âncora nada muda: o destino continua caminho + consulta.
  { chave: "sem-ancora", nome: "link sem âncora", abre: "/dashboard/conta/dados", guardado: "/dashboard/conta/dados", chega: "/dashboard/conta/dados" },
] as const;

const SAIDA = "tests/laboratorio/saida";

/** Entra pela tela do login onde a página já está, sem trocar de endereço: "Entrar com senha", e-mail, senha, Entrar. */
async function entrarPelaTela(page: Page, email: string, senha: string): Promise<void> {
  await liberarLimiteLogin(email);
  await liberarLimiteLoginIp();
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  const campoSenha = page.locator('input[name="password"], input[type="password"]').first();
  const campoEmail = page.locator('input[name="email"], input[type="email"]').first();
  await expect(async () => {
    if (!new URL(page.url()).pathname.startsWith("/auth")) return;
    // O botão só troca de modo com a página hidratada; o campo da senha aparecer é o sinal de que o formulário responde.
    if (!(await campoSenha.isVisible())) await page.getByTestId("entrar-com-senha").click({ timeout: 5_000 });
    await expect(campoSenha).toBeVisible({ timeout: 5_000 });
    if ((await campoEmail.inputValue({ timeout: 5_000 })) !== email) await campoEmail.fill(email, { timeout: 5_000 });
    if ((await campoSenha.inputValue({ timeout: 5_000 })) !== senha) await campoSenha.fill(senha, { timeout: 5_000 });
    await page.locator("form").getByRole("button", { name: /^entrar$/i }).click({ timeout: 5_000 });
    await page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 15_000 });
  }).toPass({ timeout: 50_000 });
}

const caminhoEAncora = (page: Page) => {
  const u = new URL(page.url());
  return u.pathname + u.hash;
};

test.describe("T1678 — E1002: a âncora do link sobrevive ao login", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 120_000 });
  const senha = novaSenha();
  const conta = { email: `ancora.t1678.${novoSufixo()}@lab.vivanomads.test`, nome: "Aurora Âncora", role: "tenant" as const };
  let id: string | undefined;

  test.beforeAll(async () => {
    id = await criarConta(conta, senha);
  });
  test.afterAll(async () => {
    await apagarContas([id]);
  });

  for (const largura of [390, 1280] as const) {
    for (const caso of CASOS) {
      test(`${caso.nome}, a ${largura} px: sem sessão → login → ${caso.chega}`, async ({ browser }) => {
        const ctx = await browser.newContext({ viewport: { width: largura, height: 900 } });
        const page = await ctx.newPage();
        try {
          await page.goto(caso.abre, { waitUntil: "domcontentloaded" });
          // O proxy manda ao login com o destino guardado (caminho + consulta); o navegador mantém a âncora.
          await expect.poll(() => new URL(page.url()).pathname, { timeout: 20_000 }).toBe("/auth");
          const noLogin = new URL(page.url());
          expect(noLogin.searchParams.get("redirect"), "destino guardado pelo proxy").toBe(caso.guardado);
          expect(noLogin.hash, "a âncora chega à tela do login").toBe(new URL(caso.abre, "http://x").hash);

          await entrarPelaTela(page, conta.email, senha);

          await expect.poll(() => caminhoEAncora(page), { timeout: 30_000, message: "onde a pessoa chega depois de entrar" }).toBe(caso.chega);
          if (caso.chega.endsWith("#documento")) {
            // A seção existe na tela de destino. O teste NÃO cobra que a página role até ela: hoje não rola, nem para quem
            // já estava logado (a seção é desenhada depois do carregamento). É outro achado, fora do E1002.
            await expect(page.locator("#documento")).toBeVisible({ timeout: 20_000 });
            await page.screenshot({ path: `${SAIDA}/t1678-e1002-${caso.chave}-${largura}.png` });
          }
        } finally {
          await ctx.close();
        }
      });
    }
  }
});
