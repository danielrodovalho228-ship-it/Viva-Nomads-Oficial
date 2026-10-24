import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * Rodada da vigia 24/10 (Pista C): confirmação dos merges no lab-crítico do bloco 19 (t354).
 * T365 — CONTA-A, A1 (sequência-mestre; mockup perfil-01 aprovado em 23/10): a Conta em oito telas.
 *   1. Computador (1280): /dashboard/conta abre a tela Perfil na casca — menu lateral "Conta" com as 8 seções na ordem
 *      do desenho, a ativa numa pílula verde; fundo areia; UM H1 visível ("Perfil", na coluna da direita, acima do
 *      espelho); cartão "Foto do perfil" com Nome completo / Sobre você / Cidade e "Salvar alterações"; o espelho à direita.
 *   2. Cada seção é a sua tela (/dashboard/conta/<seção>), com o seu H1; /seguranca e /excluir são subtelas de
 *      Privacidade (A8).
 *   3. Celular (390): /dashboard/conta é o menu (H1 "Conta"); Perfil abre com "‹ Conta" e o "Salvar alterações" preso
 *      no fim; nada passa da largura da tela.
 *   4. Salvar: nome, frase e idiomas (toggle E56) ficam depois de recarregar e o espelho mostra a frase.
 * Prints: tests/laboratorio/saida/t365-<tela>-<largura>.png.
 */
const SAIDA = "tests/laboratorio/saida";
const AREIA = "rgb(247, 242, 234)";
const ORDEM = ["perfil", "avaliacoes", "papeis", "dados", "privacidade", "notificacoes", "pagamentos", "ajuda"];

test.describe("T365 — CONTA-A A1: casca da Conta e a tela Perfil (perfil-01)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  const senha = novaSenha();
  const sufixo = novoSufixo();
  const inq = { email: `inq.t365.${sufixo}@lab.vivanomads.test`, nome: "Lia Moura", role: "tenant" as const };
  const ids: Record<string, string> = {};

  async function como(browser: Browser, w: number): Promise<Page> {
    const p = await entrar(browser, inq.email, senha);
    await p.setViewportSize({ width: w, height: w === 1280 ? 900 : 844 });
    return p;
  }

  async function printInteiro(p: Page, nome: string) {
    // No computador o painel rola DENTRO da coluna: solta a rolagem para o print pegar a página inteira.
    await p.evaluate(() => {
      for (let el = document.querySelector("main") as HTMLElement | null; el && el !== document.body; el = el.parentElement) {
        el.style.height = "auto";
        el.style.maxHeight = "none";
        el.style.overflow = "visible";
      }
    });
    await p.screenshot({ path: `${SAIDA}/t365-${nome}.png`, fullPage: true });
  }

  const h1Visiveis = (p: Page) => p.locator("h1:visible");

  test.beforeAll(async () => {
    ids.inq = await criarConta(inq, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.inq]);
  });

  test("1. 1280: casca com o menu lateral, fundo areia, um H1 e o Perfil com o espelho à direita", async ({ browser }) => {
    const p = await como(browser, 1280);
    await p.goto("/dashboard/conta", { waitUntil: "domcontentloaded" });
    await p.getByTestId("perfil-cartao").waitFor();

    const menu = p.getByTestId("conta-menu-lateral");
    await expect(menu).toBeVisible();
    const hrefs = await menu.locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    expect(hrefs).toEqual(ORDEM.map((s) => `/dashboard/conta/${s}`));
    const ativo = p.getByTestId("conta-menu-perfil");
    await expect(ativo).toHaveAttribute("aria-current", "page");
    await expect(ativo).toHaveCSS("background-color", "rgb(28, 107, 58)");
    await expect(p.locator('[data-testid^="conta-menu-"][aria-current="page"]')).toHaveCount(1);

    await expect(h1Visiveis(p)).toHaveCount(1);
    await expect(h1Visiveis(p)).toHaveText("Perfil");
    await expect(p.locator("[data-painel-main]")).toHaveCSS("background-color", AREIA);

    // Cartão da foto + campos + um "Salvar alterações" visível.
    const cartao = p.getByTestId("perfil-cartao");
    await expect(cartao.getByRole("heading", { name: "Foto do perfil" })).toBeVisible();
    await expect(cartao.getByText("Nome completo")).toBeVisible();
    await expect(cartao.getByText("Sobre você", { exact: true })).toBeVisible();
    await expect(p.getByTestId("perfil-salvar")).toBeVisible();
    await expect(p.getByTestId("perfil-salvar-celular")).toBeHidden();

    // Espelho na coluna da direita (à direita do cartão), um só visível.
    const espelho = p.locator('[data-testid="espelho-perfil"]:visible');
    await expect(espelho).toHaveCount(1);
    const e = (await espelho.boundingBox())!;
    const c = (await cartao.boundingBox())!;
    expect(e.x).toBeGreaterThan(c.x + c.width - 1);
    await expect(espelho).toContainText("É assim que o proprietário te vê");

    // Opcionais fechados sem dados (E56).
    await expect(p.getByTestId("pets-toggle-bloco-toggle")).toHaveAttribute("aria-checked", "false");
    await expect(p.getByTestId("idiomas-toggle-bloco-toggle")).toHaveAttribute("aria-checked", "false");

    await printInteiro(p, "perfil-1280");
    await p.context().close();
  });

  test("2. 1280: cada seção é a sua tela, com o seu H1 e a pílula no lugar; endereços antigos", async ({ browser }) => {
    const p = await como(browser, 1280);
    await p.goto("/dashboard/conta", { waitUntil: "domcontentloaded" });
    await p.getByTestId("conta-menu-dados").click();
    await expect(p).toHaveURL(/\/dashboard\/conta\/dados$/);
    await expect(h1Visiveis(p)).toHaveText("Meus dados"); // A4: título do mockup perfil-04
    await expect(p.getByTestId("conta-menu-dados")).toHaveAttribute("aria-current", "page");

    const titulos: Record<string, string> = {
      avaliacoes: "Avaliações",
      papeis: "Papéis e intenção",
      privacidade: "Privacidade",
      notificacoes: "Notificações",
      pagamentos: "Pagamentos",
      ajuda: "Ajuda",
    };
    for (const [s, t] of Object.entries(titulos)) {
      await p.goto(`/dashboard/conta/${s}`, { waitUntil: "domcontentloaded" });
      await expect(h1Visiveis(p), s).toHaveText(t);
      await expect(p.getByTestId(`conta-menu-${s}`)).toHaveAttribute("aria-current", "page");
    }
    // /seguranca é a subtela "Segurança e verificações" de Privacidade (rota própria, na casca).
    await p.goto("/dashboard/conta/seguranca", { waitUntil: "domcontentloaded" });
    await expect(h1Visiveis(p)).toHaveText("Segurança e verificações");
    await expect(p.getByTestId("conta-menu-privacidade")).toHaveAttribute("aria-current", "page");
    await p.goto("/dashboard/conta/excluir", { waitUntil: "domcontentloaded" });
    await expect(h1Visiveis(p)).toHaveText("Sair da Viva");
    await expect(p.getByTestId("conta-menu-privacidade")).toHaveAttribute("aria-current", "page");
    await expect(p.getByTestId("sair-da-viva")).toBeVisible();
    await p.goto("/dashboard/conta/privacidade", { waitUntil: "domcontentloaded" });
    await printInteiro(p, "privacidade-1280");
    await p.context().close();
  });

  test("3. 390: menu da Conta → Perfil com '‹ Conta', um H1 e o salvar preso; sem rolagem para o lado", async ({ browser }) => {
    const p = await como(browser, 390);
    // Toca depois de a página assentar: as leituras do painel (Server Actions) entram na mesma fila da navegação.
    await p.goto("/dashboard/conta", { waitUntil: "networkidle" });
    await p.getByTestId("conta-menu").waitFor();
    await expect(h1Visiveis(p)).toHaveCount(1);
    await expect(h1Visiveis(p)).toHaveText("Conta");
    await printInteiro(p, "menu-390");

    await p.getByTestId("conta-menu").getByRole("link", { name: /^Perfil/ }).click();
    await expect(p).toHaveURL(/\/dashboard\/conta\/perfil$/);
    await p.getByTestId("perfil-cartao").waitFor();
    await expect(p.getByTestId("conta-voltar")).toBeVisible();
    await expect(h1Visiveis(p)).toHaveCount(1);
    await expect(h1Visiveis(p)).toHaveText("Perfil");
    await expect(p.getByTestId("perfil-salvar-celular")).toBeVisible();
    await expect(p.getByTestId("perfil-salvar")).toBeHidden();
    await expect(p.locator('[data-testid="espelho-perfil"]:visible')).toHaveCount(1);
    const larg = await p.evaluate(() => document.documentElement.scrollWidth);
    expect(larg).toBeLessThanOrEqual(390);
    await printInteiro(p, "perfil-390");

    await p.getByTestId("conta-voltar").click();
    await expect(p).toHaveURL(/\/dashboard\/conta$/);
    await p.context().close();
  });

  test("4. 1280: salvar nome, frase e idiomas; fica depois de recarregar e o espelho mostra a frase", async ({ browser }) => {
    const p = await como(browser, 1280);
    await p.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
    await p.getByTestId("perfil-cartao").waitFor();
    const frase = "Arquiteta, tranquila e organizada.";
    await p.getByTestId("perfil-nome").fill("Lia Moura Costa");
    await p.locator("#perfil-bio").fill(frase);
    await p.getByTestId("idiomas-toggle-bloco-toggle").click();
    await p.getByRole("group", { name: "Idiomas" }).getByRole("button", { name: /Inglês/ }).click();
    await p.getByTestId("perfil-salvar").click();
    await expect(p.getByTestId("perfil-salvar-msg")).toBeVisible();
    await expect(p.locator('[data-testid="espelho-sobre"]:visible')).toContainText(frase);

    await p.reload({ waitUntil: "domcontentloaded" });
    await p.getByTestId("perfil-cartao").waitFor();
    await expect(p.getByTestId("perfil-nome")).toHaveValue("Lia Moura Costa");
    await expect(p.locator("#perfil-bio")).toHaveValue(frase);
    await expect(p.getByTestId("idiomas-toggle-bloco-toggle")).toHaveAttribute("aria-checked", "true");
    await expect(p.locator('[data-testid="espelho-nome"]:visible')).toHaveText("Lia Moura Costa");
    await p.context().close();
  });
});
