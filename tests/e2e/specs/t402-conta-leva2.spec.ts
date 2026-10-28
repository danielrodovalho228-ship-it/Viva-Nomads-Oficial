import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T402 — Conta, leva 2 (QA do Muse, 24/10). Conta de proprietário sem parceria. 390 e 1280.
 *   E68. Verificação: "em breve" nunca aparece repetido na tela. No laboratório as integrações são simuladas e a tela
 *        mostra a verificação simulada; o estado real "em breve" (uma vez só) fica provado no unit leva2-e68-e71.
 *   E69. Celular: o "voltar" das subtelas da Conta leva de volta para onde a pessoa estava; aberta direto, para a Conta.
 *        No computador o voltar não aparece.
 *   E70. Pagamentos: foto carregando nos três cartões; cartão "em breve" com "Avise-me quando estiver disponível"
 *        (grava e confirma); o cartão de parceiro é convite com "Cadastrar meu serviço"; "Salvar chave" travado mostra a dica.
 *   E71. Ajuda: "Fale com a Viva" em destaque, com foto e a frase do atendimento; descrições das linhas; "Sair da conta"
 *        dentro do mesmo cartão.
 *   E75. Toda tela da Conta (e o menu do celular) fecha em "Viva Nomads · Uberlândia, MG", sem vão depois.
 *   E76. O item "Verificação" da barra vai direto para /dashboard/verificacao.
 */
const SAIDA = "tests/laboratorio/saida";
const FECHAMENTO = "Viva Nomads · Uberlândia, MG";

test.describe("T402 — Conta leva 2: E68, E69, E70, E71, E75, E76", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });
  const senha = novaSenha();
  const conta = { email: `dono.t402.${novoSufixo()}@lab.vivanomads.test`, nome: "Rui Teixeira", role: "owner" as const };
  let id = "";
  test.beforeAll(async () => {
    id = await criarConta(conta, senha);
    // Proprietário de verdade (com um anúncio): é quem vê o cartão "Como você recebe" (Pix) em Pagamentos.
    await criarImovelPronto(id, `Studio da leva 2 ${novoSufixo()}`);
  });
  test.afterAll(async () => {
    await apagarContas([id]);
  });

  async function abrir(browser: Browser, w: number, rota: string): Promise<Page> {
    const p = await entrar(browser, conta.email, senha);
    await p.setViewportSize({ width: w, height: w === 1280 ? 900 : 844 });
    await p.goto(rota, { waitUntil: "domcontentloaded" });
    await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    return p;
  }
  const semRolagemLateral = async (p: Page) =>
    expect(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  // A foto é carregada sob demanda (lazy): rola até ela antes de conferir que carregou de verdade.
  const fotoCarregou = async (p: Page, testId: string) => {
    const img = p.getByTestId(testId).locator('[data-testid="cartao-foto"] img');
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0), { timeout: 15_000 }).toBe(true);
  };
  /** E75: a linha de fechamento é o último texto da tela e não sobra vão depois dela (até as abas, no celular). */
  async function fechaLimpo(p: Page) {
    const fim = p.getByTestId("conta-fechamento").filter({ visible: true });
    await expect(fim).toHaveCount(1);
    await expect(fim).toHaveText(FECHAMENTO);
    await fim.scrollIntoViewIfNeeded();
    const m = await fim.evaluate((el) => {
      const rolavel = document.querySelector<HTMLElement>("[data-painel-main]");
      const alvo = rolavel && rolavel.scrollHeight > rolavel.clientHeight ? rolavel : document.documentElement;
      alvo.scrollTop = alvo.scrollHeight;
      window.scrollTo(0, document.documentElement.scrollHeight);
      const abas = [...document.querySelectorAll<HTMLElement>("nav[data-papel]")].find((n) => getComputedStyle(n).position === "fixed" && n.offsetHeight > 0);
      const piso = abas ? abas.getBoundingClientRect().top : (rolavel && alvo === rolavel ? rolavel.getBoundingClientRect().bottom : window.innerHeight);
      // Tela mais curta que a janela não rola: o espaço embaixo é a janela, não um vão depois do fim.
      const rola = alvo.scrollHeight > alvo.clientHeight + 1;
      return { depois: piso - el.getBoundingClientRect().bottom, rola };
    });
    expect(m.depois, JSON.stringify(m)).toBeGreaterThanOrEqual(0);
    if (m.rola) expect(m.depois, JSON.stringify(m)).toBeLessThanOrEqual(120);
  }

  for (const w of [390, 1280]) {
    test(`E68. a ${w} px: Verificação diz "em breve" uma vez só`, async ({ browser }) => {
      const p = await abrir(browser, w, "/dashboard/verificacao");
      await p.locator("h1").filter({ hasText: "Verificação" }).first().waitFor({ timeout: 20_000 });
      await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      const vezes = await p.locator("main").evaluate((m) => ((m as HTMLElement).innerText.match(/em breve/gi) ?? []).length);
      expect(vezes).toBeLessThanOrEqual(1);
      await semRolagemLateral(p);
      await expect(p.getByTestId("conta-voltar")).toBeVisible({ visible: w === 390 });
      await p.screenshot({ path: `${SAIDA}/t402-verificacao-${w}.png`, fullPage: w === 390 });
      await p.context().close();
    });

    test(`E70 + E75. a ${w} px: Pagamentos com fotos, "em breve" honesto, convite de parceiro e dica do Salvar chave`, async ({ browser }) => {
      const p = await abrir(browser, w, "/dashboard/conta/pagamentos");
      await p.getByTestId("conta-pagamentos").waitFor({ timeout: 20_000 });
      for (const c of ["conta-pix", "conta-pag-morador", "conta-pag-parceiro"]) await fotoCarregou(p, c);
      await expect(p.getByTestId("conta-cartao-em-breve")).toHaveText("Pagamento com cartão: em breve.");
      await expect(p.getByTestId("conta-parceiro-nota")).toHaveText("Ofereça serviços para moradores e proprietários e receba direto.");
      await expect(p.getByTestId("conta-parceiro-botao")).toHaveText("Cadastrar meu serviço");
      await expect(p.getByTestId("conta-parceiro-botao")).toHaveAttribute("href", "/dashboard/parceiro");
      await expect(p.getByTestId("conta-pix-salvar")).toBeDisabled();
      await expect(p.getByTestId("conta-pix-dica")).toHaveText("Preencha a chave para salvar.");
      await p.getByTestId("conta-pix-chave").fill("rui@exemplo.com");
      await expect(p.getByTestId("conta-pix-dica")).toHaveCount(0);
      await expect(p.getByTestId("conta-pix-salvar")).toBeEnabled();
      await p.getByTestId("conta-pix-chave").fill("");
      await expect(p.locator("main")).not.toContainText(/comiss|h[oó]spede|reserva/i);
      await semRolagemLateral(p);
      await fechaLimpo(p);
      await p.evaluate(() => document.querySelector("[data-painel-main]")?.scrollTo(0, 0));
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.screenshot({ path: `${SAIDA}/t402-pagamentos-${w}.png`, fullPage: w === 390 });
      await p.getByTestId("conta-cartao-avise").click();
      await expect(p.getByTestId("conta-cartao-avisado")).toHaveText("Avisaremos você quando abrir.");
      await p.reload({ waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("conta-cartao-avisado")).toBeVisible({ timeout: 20_000 });
      await p.context().close();
    });

    test(`E71 + E75. a ${w} px: Ajuda com o contato em destaque e Sair no cartão`, async ({ browser }) => {
      const p = await abrir(browser, w, "/dashboard/conta/ajuda");
      await p.getByTestId("tela-ajuda").waitFor({ timeout: 20_000 });
      await fotoCarregou(p, "ajuda-contato");
      await expect(p.getByTestId("ajuda-contato-linha")).toHaveText("Assistente Viva 24 h · resposta de uma pessoa em até 24 h");
      await expect(p.getByTestId("ajuda-link-fale")).toBeVisible();
      await expect(p.getByTestId("ajuda-desc-central")).toHaveText("Guias e respostas rápidas");
      await expect(p.getByTestId("ajuda-desc-termos")).toHaveText("As regras da plataforma");
      await expect(p.getByTestId("ajuda-desc-privacidade")).toHaveText("Seus dados, suas regras");
      // A foto só no cartão do contato.
      await expect(p.getByTestId("tela-ajuda").locator('[data-testid="cartao-foto"]')).toHaveCount(1);
      // "Sair da conta" é a última linha do mesmo cartão dos links.
      const mesmaLista = await p.getByTestId("ajuda-sair").evaluate((b) => {
        const ul = b.closest("ul");
        return !!ul && !!ul.querySelector('[data-testid="ajuda-link-privacidade"]') && ul.lastElementChild === b.closest("li");
      });
      expect(mesmaLista).toBe(true);
      await semRolagemLateral(p);
      await fechaLimpo(p);
      await p.evaluate(() => document.querySelector("[data-painel-main]")?.scrollTo(0, 0));
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.screenshot({ path: `${SAIDA}/t402-ajuda-${w}.png`, fullPage: w === 390 });
      await p.context().close();
    });
  }

  test("E69 + E75. a 390 px: o voltar volta para onde a pessoa estava; aberta direto, vai para a Conta", async ({ browser }) => {
    const p = await abrir(browser, 390, "/dashboard/conta");
    await p.getByTestId("conta-menu").waitFor({ timeout: 20_000 });
    await fechaLimpo(p);
    await p.getByTestId("conta-menu").getByRole("link", { name: /Notificações/ }).click();
    // E176 (parte 2): Notificações é a página única do sino, na casca da Conta.
    await p.waitForURL("**/dashboard/notificacoes");
    await p.getByTestId("conta-voltar").click();
    await p.waitForURL((u) => u.pathname === "/dashboard/conta");
    // Aberta direto (sem histórico do site): o voltar vai para a Conta.
    const q = await abrir(browser, 390, "/dashboard/conta/dados");
    await expect(q.getByTestId("conta-voltar")).toHaveAttribute("href", "/dashboard/conta");
    await q.getByTestId("conta-voltar").click();
    await q.waitForURL((u) => u.pathname === "/dashboard/conta");
    await q.context().close();
    await p.context().close();
  });

  test("E69 + E176. a 1280 px: sem voltar; 'Segurança e verificações' é item próprio do menu da Conta", async ({ browser }) => {
    const p = await abrir(browser, 1280, "/dashboard/conta/dados");
    await expect(p.getByTestId("conta-voltar")).toBeHidden();
    const item = p.getByTestId("conta-menu-seguranca");
    await expect(item).toBeVisible();
    await item.click();
    await p.waitForURL((u) => u.pathname === "/dashboard/conta/seguranca");
    await expect(p.getByTestId("conta-menu-seguranca")).toHaveAttribute("aria-current", "page");
    await p.context().close();
  });
});
