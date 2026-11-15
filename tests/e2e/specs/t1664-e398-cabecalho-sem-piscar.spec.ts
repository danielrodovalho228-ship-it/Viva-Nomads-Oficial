import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1664 — E398: quem está logado não vê o "Entrar" piscar no cabeçalho público.
  O HTML das páginas públicas é o mesmo para todos: o servidor entrega o "Entrar", e o cabeçalho só trocava para
  "Meu painel" depois de carregar. Por um instante a pessoa logada via o cabeçalho de visitante e lia "caí da conta".
  O teste amostra o cabeçalho a cada mudança da página e a cada quadro, desde antes da primeira pintura:
   1. logado, a 1280 px: em nenhuma amostra o "Entrar" está visível, e o cabeçalho assenta em "Meu painel";
   2. visitante: o "Entrar" está lá desde a primeira amostra (nada muda para quem não tem sessão);
   3. pista velha (o navegador lembra de um login, mas a sessão acabou): o "Entrar" volta sozinho;
   4. a 390 px o "Entrar" mora no menu: aberto depois de carregar, mostra "Meu painel".
*/
const senha = novaSenha();
const conta = { email: `conta.t1664.${novoSufixo()}@lab.vivanomads.test`, nome: "Pia Pisca", role: "tenant" as const };
let id: string | undefined;
const PAGINAS = ["/ajuda", "/"];

type Amostra = { entrar: boolean; painel: boolean };
declare global {
  interface Window {
    __amostrasDoCabecalho?: Amostra[];
  }
}

/** Antes de qualquer script da página: guarda, a cada mudança do documento e a cada quadro, o que o cabeçalho mostra. */
async function amostrarCabecalho(page: Page) {
  await page.addInitScript(() => {
    const amostras: { entrar: boolean; painel: boolean }[] = [];
    window.__amostrasDoCabecalho = amostras;
    const visivel = (e: Element | null) => !!e && getComputedStyle(e).visibility !== "hidden" && e.getClientRects().length > 0;
    const ver = () => {
      amostras.push({ entrar: visivel(document.querySelector('[data-testid="nav-entrar"]')), painel: visivel(document.querySelector('[data-testid="nav-meu-painel"]')) });
    };
    new MutationObserver(ver).observe(document, { childList: true, subtree: true, attributes: true });
    const quadro = () => {
      ver();
      requestAnimationFrame(quadro);
    };
    quadro();
  });
}
const amostras = (page: Page) => page.evaluate(() => window.__amostrasDoCabecalho ?? []);

test.describe("T1664 — E398: o cabeçalho público não pisca o Entrar para quem está logado", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.beforeAll(async () => {
    id = await criarConta(conta, senha);
  });
  test.afterAll(async () => {
    await apagarContas([id]);
  });

  for (const rota of PAGINAS) {
    test(`1280 px, logado, ${rota}: o Entrar não aparece em nenhum quadro e o cabeçalho assenta em Meu painel`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await entrarNaPagina(page, conta.email, senha);
      await amostrarCabecalho(page);
      await page.goto(rota, { waitUntil: "load" });
      await expect(page.getByTestId("nav-meu-painel")).toBeVisible({ timeout: 20_000 });
      const lista = await amostras(page);
      expect(lista.length, "o cabeçalho foi amostrado desde o começo da carga").toBeGreaterThan(5);
      expect(lista.filter((a) => a.entrar).length, `amostras com o "Entrar" visível (de ${lista.length})`).toBe(0);
      await expect(page.getByTestId("nav-entrar")).toHaveCount(0);
    });
  }

  test("1280 px, visitante: o Entrar está lá desde a primeira amostra do cabeçalho", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await amostrarCabecalho(page);
    await page.goto("/ajuda", { waitUntil: "load" });
    await expect(page.getByTestId("nav-entrar")).toBeVisible();
    const lista = await amostras(page);
    // Depois que o cabeçalho existe no documento, o "Entrar" nunca some para o visitante.
    const desdeOCabecalho = lista.slice(lista.findIndex((a) => a.entrar));
    expect(desdeOCabecalho.length).toBeGreaterThan(3);
    expect(desdeOCabecalho.every((a) => a.entrar && !a.painel)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.hasAttribute("data-sessao"))).toBe(false);
    await ctx.close();
  });

  test("1280 px, pista velha (o navegador lembra do login, mas a sessão acabou): o Entrar volta sozinho", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await entrarNaPagina(page, conta.email, senha);
    // A sessão acaba (cookies fora); a lembrança local do login fica.
    await page.context().clearCookies();
    await page.goto("/ajuda", { waitUntil: "load" });
    await expect(page.getByTestId("nav-entrar")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("nav-meu-painel")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.hasAttribute("data-sessao"))).toBe(false);
  });

  test("390 px, logado: o menu, aberto depois de carregar, mostra Meu painel (o Entrar não aparece)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await entrarNaPagina(page, conta.email, senha);
    await page.goto("/ajuda", { waitUntil: "load" });
    await page.getByTestId("nav-menu").click();
    const menu = page.getByTestId("nav-menu-lista");
    await expect(menu.getByTestId("nav-meu-painel")).toBeVisible({ timeout: 20_000 });
    await expect(menu.getByRole("link", { name: "Entrar", exact: true })).toHaveCount(0);
  });
});
