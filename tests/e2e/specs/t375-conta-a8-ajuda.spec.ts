import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T375 — CONTA-A A8 (mockup perfil-08): Conta › Ajuda.
 *   1. Um cartão com Central de ajuda, Fale com a Viva, Termos de uso e Política de privacidade, nessa ordem, cada um
 *      com o seu destino; "Sair da conta"; o rodapé "Viva Nomads · Uberlândia, MG". 1280 e 390, com prints.
 *   2. "Sair da conta" encerra a sessão.
 *   3. "Sair da Viva" (pausar/apagar) é a subtela /dashboard/conta/excluir, com Privacidade ativa no menu.
 */
const SAIDA = "tests/laboratorio/saida";
const LINKS = [
  ["central", "Central de ajuda", "/ajuda"],
  ["fale", "Fale com a Viva", "/ajuda?novo=1"],
  ["termos", "Termos de uso", "/termos"],
  ["privacidade", "Política de privacidade", "/privacidade"],
] as const;

test.describe("T375 — CONTA-A A8: Ajuda (perfil-08)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  const senha = novaSenha();
  const conta = { email: `inq.t368.${novoSufixo()}@lab.vivanomads.test`, nome: "Marina Alves", role: "tenant" as const };
  let id = "";
  async function como(browser: Browser, w: number): Promise<Page> {
    const p = await entrar(browser, conta.email, senha);
    await p.setViewportSize({ width: w, height: w === 1280 ? 900 : 844 });
    return p;
  }
  test.beforeAll(async () => {
    id = await criarConta(conta, senha);
  });
  test.afterAll(async () => {
    await apagarContas([id]);
  });

  for (const w of [1280, 390]) {
    test(`1. a ${w} px: contato em destaque, as linhas com descrição, Sair no cartão e o fechamento`, async ({ browser }) => {
      const p = await como(browser, w);
      await p.goto("/dashboard/conta/ajuda", { waitUntil: "domcontentloaded" });
      await p.getByTestId("tela-ajuda").waitFor();
      await expect(p.locator("h1:visible")).toHaveText("Ajuda");
      // E71: "Fale com a Viva" é o cartão em destaque (foto carregando + a frase do atendimento), primeiro na tela.
      const contato = p.getByTestId("ajuda-contato");
      await expect(contato).toContainText("Assistente Viva 24 h · resposta de uma pessoa em até 24 h");
      const foto = contato.getByTestId("cartao-foto").locator("img");
      await expect.poll(() => foto.evaluate((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0), { timeout: 15_000 }).toBe(true);
      const links = p.getByTestId("tela-ajuda").locator('a[data-testid^="ajuda-link-"]');
      await expect(links).toHaveCount(4);
      const ordem = [LINKS[1], LINKS[0], LINKS[2], LINKS[3]];
      for (const [i, [chave, rotulo, href]] of ordem.entries()) {
        const l = links.nth(i);
        await expect(l).toHaveAttribute("data-testid", `ajuda-link-${chave}`);
        await expect(l).toContainText(chave === "fale" ? "Falar com a Viva" : rotulo);
        await expect(l).toHaveAttribute("href", href);
      }
      // E71: cada linha com a sua descrição; foto só no contato.
      await expect(p.getByTestId("ajuda-desc-central")).toHaveText("Guias e respostas rápidas");
      await expect(p.getByTestId("ajuda-desc-termos")).toHaveText("As regras da plataforma");
      await expect(p.getByTestId("ajuda-desc-privacidade")).toHaveText("Seus dados, suas regras");
      await expect(p.getByTestId("tela-ajuda").getByTestId("cartao-foto")).toHaveCount(1);
      // E71/E75: "Sair da conta" dentro do cartão; a tela fecha na linha institucional, sem vão.
      await expect(p.getByTestId("ajuda-sair")).toHaveText("Sair da conta");
      await expect(p.getByTestId("conta-fechamento")).toHaveText("Viva Nomads · Uberlândia, MG");
      if (w === 1280) await expect(p.getByTestId("conta-menu-ajuda")).toHaveAttribute("aria-current", "page");
      else await expect(p.getByTestId("conta-voltar")).toBeVisible();
      expect(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await p.screenshot({ path: `${SAIDA}/t375-ajuda-${w}.png`, fullPage: true });
      await p.context().close();
    });
  }

  test("3. Sair da Viva é a subtela de Privacidade (/dashboard/conta/excluir)", async ({ browser }) => {
    const p = await como(browser, 1280);
    await p.goto("/dashboard/conta/excluir", { waitUntil: "domcontentloaded" });
    await expect(p.locator("h1:visible")).toHaveText("Sair da Viva");
    await expect(p.getByTestId("conta-menu-privacidade")).toHaveAttribute("aria-current", "page");
    await expect(p.getByTestId("sair-da-viva")).toBeVisible();
    await p.context().close();
  });

  test("2. Sair da conta encerra a sessão", async ({ browser }) => {
    const p = await como(browser, 390);
    await p.goto("/dashboard/conta/ajuda", { waitUntil: "domcontentloaded" });
    await p.getByTestId("ajuda-sair").click();
    await p.waitForURL(/\/app\/boas-vindas/, { timeout: 30_000 });
    await p.goto("/dashboard/conta/ajuda", { waitUntil: "domcontentloaded" });
    await expect(p).toHaveURL(/\/auth/);
    await p.context().close();
  });
});
