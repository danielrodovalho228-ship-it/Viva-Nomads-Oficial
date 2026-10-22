import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";

/*
  T192 — Conta em 4 blocos (prompt 18), a 390 e 1280 px:
  - blocos Conta → Notificações → Privacidade e segurança → Pagamentos, nessa ordem (Prompt 43, #1038; o perfil
    público e os dados ficam dentro de Conta);
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
      test(`${largura}px — 4 blocos, sem repetição, confiança numa lista só`, async ({ page }) => {
        await page.setViewportSize({ width: largura, height: 900 });
        await page.goto("/dashboard/conta", { waitUntil: "networkidle" });
        const blocos = page.locator('[data-testid^="bloco-"]');
        await expect(blocos).toHaveCount(4);
        expect(await blocos.evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")))).toEqual([
          "bloco-conta",
          "bloco-notificacoes",
          "bloco-confianca",
          "bloco-pagamentos",
        ]);
        const corpo = await page.locator("main").innerText();
        expect(corpo).not.toMatch(/Simulador tributário|Tributação das locações/);
        expect(corpo.match(/Alterar senha/g)?.length ?? 0).toBeLessThanOrEqual(1);
        await expect(page.getByRole("heading", { name: "Verificação", exact: true })).toHaveCount(0);

        const lista = page.getByTestId("confianca-lista");
        for (const chave of ["email", "celular", "identidade", "duas-etapas", "senha"]) await expect(lista.getByTestId(`confianca-${chave}`)).toHaveCount(1);
        // Conta de teste (laboratório) → "Verificar identidade (simulado — conta de teste)"; conta real → "Em breve" (src/lib/identidade/estado.ts).
        await expect(lista.getByTestId("confianca-identidade")).toContainText(/Em breve|simulado — conta de teste/);
        await expect(lista.getByTestId("confianca-linkedin")).toHaveCount(persona === "inquilino" ? 1 : 0);
        await expect(lista.getByTestId("confianca-senha").getByRole("link")).toHaveAttribute("href", "/dashboard/conta/seguranca");

        // Prompt 43: o link "Ver como os outros veem" deu lugar ao próprio cartão do perfil público dentro de Conta.
        await expect(page.getByTestId("seu-perfil-publico")).toBeVisible();
        await semRolagemLateral(page);
        await page.screenshot({ path: `${SAIDA}/t192-conta-${rotulo}-${largura}.png`, fullPage: true });

        // "Verificação" do menu leva à lista.
        await page.goto("/dashboard/conta#confianca", { waitUntil: "networkidle" });
        await expect(page.getByTestId("bloco-confianca")).toBeInViewport();
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
      await page.goto("/dashboard/ferramentas", { waitUntil: "networkidle" });
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
      await visitante.goto("/auth?cadastro=1&papel=owner", { waitUntil: "networkidle" });
      expect(await visitante.locator("body").innerText()).not.toContain("Simulador tributário PF × PJ");
      await expect(visitante.locator('a[href="/tributario"]')).toHaveCount(0);
      await ctx.close();
    });
  }
});
