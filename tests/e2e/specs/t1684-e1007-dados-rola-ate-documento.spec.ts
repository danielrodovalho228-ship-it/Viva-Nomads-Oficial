import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";

/*
  T1684 — E1007 (Gerente, ronda 21:49 de 16/11/2026): "Meus dados" rola até a seção da âncora.
  /dashboard/conta/dados#documento abria no topo da tela: a seção Documento só é desenhada depois do carregamento e os
  blocos de cima ainda mudam de altura. A pessoa chegava à tela certa e tinha de procurar a seção.
  O teste cobra, a 390 e 1280 px:
    1. a seção da âncora fica à vista, no alto da tela, e CONTINUA lá depois de a página terminar de carregar;
    2. o mesmo para o link antigo da Conta (/dashboard/conta#documento, E798) e para a âncora do celular;
    3. a tela não disputa a rolagem: a pessoa rola de volta ao topo e fica no topo;
    4. sem âncora, a tela abre no topo, como antes.
*/

/** Onde o topo da seção está na tela, em px a partir do alto da janela (null se a seção não existe). */
const topoDaSecao = (page: Page, id: string) => page.evaluate((i) => document.getElementById(i)?.getBoundingClientRect().top ?? null, id);

/** A tela terminou de carregar os blocos que mudam de altura: sem esqueleto do documento e com os campos de Meus dados prontos. */
async function paginaAssentou(page: Page): Promise<void> {
  await expect(page.getByTestId("documento-carregando")).toHaveCount(0, { timeout: 30_000 });
  await expect(page.locator('input[value="Carregando..."], input[placeholder="Carregando..."]')).toHaveCount(0, { timeout: 30_000 });
  // A altura da página parou de mudar.
  let antes = -1;
  await expect
    .poll(async () => {
      const h = await page.evaluate(() => document.documentElement.scrollHeight + (document.querySelector("main")?.scrollHeight ?? 0));
      const parou = h === antes;
      antes = h;
      return parou;
    }, { timeout: 15_000, intervals: [400] })
    .toBe(true);
}

/** À vista e no alto: o topo da seção entre o alto da janela e a metade dela. */
async function secaoNoAltoDaTela(page: Page, id: string, altura: number, quando: string): Promise<void> {
  await expect
    .poll(async () => {
      const t = await topoDaSecao(page, id);
      return t !== null && t >= 0 && t <= altura / 2;
    }, { timeout: 15_000, message: `#${id} no alto da tela (${quando})` })
    .toBe(true);
}

test.describe("T1684 — E1007: Meus dados rola até a seção da âncora", () => {
  test.skip(!hasAccount("inquilino"), "Sem a conta de teste inquilino.");
  test.use({ storageState: authFile("inquilino") });

  for (const [largura, altura] of [[390, 844], [1280, 900]] as const) {
    for (const caso of [
      { nome: "Documento", abre: "/dashboard/conta/dados#documento", id: "documento" },
      { nome: "Documento, pelo link antigo da Conta (E798)", abre: "/dashboard/conta#documento", id: "documento" },
      { nome: "Celular", abre: "/dashboard/conta/dados#celular", id: "celular" },
    ]) {
      test(`a ${largura} px: ${caso.nome} fica à vista e continua lá depois de a página carregar`, async ({ page }) => {
        await page.setViewportSize({ width: largura, height: altura });
        await page.goto(caso.abre, { waitUntil: "domcontentloaded" });
        await expect.poll(() => new URL(page.url()).pathname + new URL(page.url()).hash, { timeout: 20_000 }).toBe(`/dashboard/conta/dados#${caso.id}`);
        await secaoNoAltoDaTela(page, caso.id, altura, "ao chegar");
        await paginaAssentou(page);
        await secaoNoAltoDaTela(page, caso.id, altura, "depois de a página carregar");
        if (caso.abre === "/dashboard/conta/dados#documento") await page.screenshot({ path: `tests/laboratorio/saida/t1684-e1007-documento-${largura}.png` });
      });
    }

    test(`a ${largura} px: a tela não disputa a rolagem com a pessoa`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: altura });
      await page.goto("/dashboard/conta/dados#documento", { waitUntil: "domcontentloaded" });
      await secaoNoAltoDaTela(page, "documento", altura, "ao chegar");
      // A pessoa volta ao topo com o teclado (um gesto dela) logo a seguir, com a página ainda a assentar.
      await page.keyboard.press("Home");
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        document.querySelector("main")?.scrollTo(0, 0);
      });
      await paginaAssentou(page);
      await page.waitForTimeout(1_500);
      const t = await topoDaSecao(page, "documento");
      expect(t !== null && t > altura / 2, `a seção ficou lá embaixo, onde a pessoa a deixou (topo em ${t} px)`).toBe(true);
    });

    test(`a ${largura} px: sem âncora, Meus dados abre no topo`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: altura });
      await page.goto("/dashboard/conta/dados", { waitUntil: "domcontentloaded" });
      await paginaAssentou(page);
      await expect(page.locator("h1:visible").first()).toBeInViewport();
      expect(await page.evaluate(() => window.scrollY + (document.querySelector("main")?.scrollTop ?? 0)), "rolagem").toBe(0);
    });
  }
});
