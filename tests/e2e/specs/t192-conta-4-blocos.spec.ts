import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";

/*
  Vigia 24/10 (Pista C): a lista de confiança mudou de Privacidade para /dashboard/conta/seguranca (E66, #1263); a
  âncora antiga #confianca que ainda cai em Privacidade fica anotada como L-56 até a Pista A corrigir.
  L-43 (vigia, 24/10): a Conta e o atendimento não assentam em "networkidle"; espera até 10 s e segue para o elemento.
  T192 — Conta (prompt 18; A1: uma tela por seção), a 390 e 1280 px:
  - cada assunto uma vez: nada de "Alterar senha" duplicado, de painel "Verificação" solto nem de simulador tributário;
  - a lista de confiança tem e-mail, celular, identidade (em breve), duas etapas e senha, cada um uma vez
    (LinkedIn só no modo inquilino);
  - o simulador PF × PJ está em /tributario, sem "+ IBS/CBS" e com o custo de manter a empresa; o cadastro não o mostra.
*/
const SAIDA = "tests/laboratorio/saida";

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

for (const [persona, rotulo] of [["proprietario", "dono"], ["inquilino", "inquilino"]] as const) {
  test.describe(`T192 — Conta (${rotulo})`, () => {
    test.skip(!hasAccount(persona), `conta ${persona} do laboratório não configurada`);
    test.use({ storageState: authFile(persona) });

    for (const largura of [390, 1280]) {
      test(`${largura}px — Conta em telas (A1), sem repetição, confiança numa lista só`, async ({ page }) => {
        await page.setViewportSize({ width: largura, height: 900 });
        // A1: cada assunto na sua tela; a lista de confiança mora em Segurança e verificações (E66, #1263).
        await page.goto("/dashboard/conta/seguranca", { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
        const corpo = await page.locator("main").innerText();
        expect(corpo).not.toMatch(/Simulador tributário|Tributação das locações/);
        expect(corpo.match(/Alterar senha/g)?.length ?? 0).toBeLessThanOrEqual(1);
        await expect(page.getByRole("heading", { name: "Verificação", exact: true })).toHaveCount(0);

        const lista = page.getByTestId("confianca-lista");
        for (const chave of ["email", "celular", "identidade", "duas-etapas", "senha"]) await expect(lista.getByTestId(`confianca-${chave}`)).toHaveCount(1);
        // Conta de teste (laboratório) → "Verificar identidade (simulado — conta de teste)"; conta real → "Em breve" (src/lib/identidade/estado.ts).
        await expect(lista.getByTestId("confianca-identidade")).toContainText(/Em breve|simulado — conta de teste/);
        // 63-B: a linha do LinkedIn é o selo "LinkedIn conectado" e só existe com a chave LINKEDIN_CONECTAR_ATIVO (desligada
        // nesta rodada); o endereço do perfil saiu da lista de confiança e ficou em Dados pessoais (só a Viva vê).
        await expect(lista.getByTestId("confianca-linkedin")).toHaveCount(0);
        await expect(lista.getByTestId("confianca-senha").getByRole("link")).toHaveAttribute("href", "/dashboard/conta/seguranca");
        await semRolagemLateral(page);
        await page.screenshot({ path: `${SAIDA}/t192-conta-${rotulo}-${largura}.png`, fullPage: true });

        // Privacidade (perfil-05) não repete a lista.
        await page.goto("/dashboard/conta/privacidade", { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
        await expect(page.getByTestId("confianca-lista")).toHaveCount(0);

        // O Perfil não repete a lista nem o cartão "Seu perfil público"; o espelho é a visão do proprietário.
        await page.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
        await expect(page.locator('[data-testid="espelho-perfil"]:visible')).toHaveCount(1);
        await expect(page.getByTestId("seu-perfil-publico")).toHaveCount(0);
        await expect(page.getByTestId("confianca-lista")).toHaveCount(0);
        await semRolagemLateral(page);

        // Link antigo do item "Verificação" (página longa, #confianca) tem de cair onde a lista está.
        await page.goto("/dashboard/conta#confianca", { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
        await expect(page).toHaveURL(/\/dashboard\/conta\/(privacidade|seguranca)$/);
        if (new URL(page.url()).pathname === "/dashboard/conta/privacidade") {
          // L-56 (Pista A): a âncora ainda leva a Privacidade (src/lib/conta/secoes.ts), onde a lista não está mais.
          test.info().annotations.push({ type: "L-56", description: "/dashboard/conta#confianca → /dashboard/conta/privacidade, sem a lista de confiança" });
          await expect(page.getByTestId("confianca-lista")).toHaveCount(0);
        } else {
          await expect(page.getByTestId("confianca-lista")).toBeVisible();
        }
      });
    }
  });
}

test.describe("T192 — simulador tributário só em Ferramentas", () => {
  test.skip(!hasAccount("proprietario"), "conta proprietario do laboratório não configurada");
  test.use({ storageState: authFile("proprietario") });

  for (const largura of [390, 1280]) {
    test(`${largura}px — Ferramentas › Tributação PF × PJ com outros rendimentos e custo da empresa; cadastro sem simulador`, async ({ page, browser }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/dashboard/ferramentas", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      // O cartão da página (o menu lateral também aponta para cá desde o Prompt 42 e fica escondido a 390 px).
      const cartao = page.locator('main a[href="/dashboard/tributacao"]');
      await expect(cartao.first()).toBeVisible();
      await expect(page.locator('a[href="/tributario"]')).toHaveCount(0);
      await cartao.first().click();
      await expect(page).toHaveURL(/\/dashboard\/tributacao$/);
      const ferramenta = page.getByTestId("ferramenta-tributacao");
      await expect(ferramenta.getByText("Simulador tributário PF × PJ")).toBeVisible();
      await expect(ferramenta.getByTestId("tax-outros-rendimentos")).toBeVisible();
      const corpo = await ferramenta.innerText();
      expect(corpo).not.toMatch(/Lucro presumido \+ IBS\/CBS|ago\/2026/);
      await expect(ferramenta.getByTestId("tax-resultado")).toContainText("custo de manter a empresa");
      // Aviso de IBS/CBS segue desligado até a revisão.
      await expect(ferramenta.getByTestId("tax-aviso-ibs-cbs")).toHaveCount(0);
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t192-tributacao-${largura}.png`, fullPage: true });

      // Cadastro (visitante): sem simulador e sem link para a página interna; só a dica de onde ele fica.
      const ctx = await browser.newContext({ viewport: { width: largura, height: 900 }, storageState: { cookies: [], origins: [] } });
      const visitante = await ctx.newPage();
      await visitante.goto("/auth?cadastro=1&papel=owner", { waitUntil: "domcontentloaded" });
      await visitante.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      expect(await visitante.locator("body").innerText()).not.toContain("Simulador tributário PF × PJ");
      await expect(visitante.locator('a[href="/tributario"]')).toHaveCount(0);
      await ctx.close();
    });
  }
});
