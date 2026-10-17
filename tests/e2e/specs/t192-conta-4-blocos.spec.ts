import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";

/*
  T192 — Conta em 4 blocos (prompt 18), a 390 e 1280 px:
  - blocos Perfil público → Dados da conta → Confiança e segurança → Preferências, nessa ordem;
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
          "bloco-perfil-publico",
          "bloco-dados",
          "bloco-confianca",
          "bloco-preferencias",
        ]);
        const corpo = await page.locator("main").innerText();
        expect(corpo).not.toMatch(/Simulador tributário|Tributação das locações/);
        expect(corpo.match(/Alterar senha/g)?.length ?? 0).toBeLessThanOrEqual(1);
        await expect(page.getByRole("heading", { name: "Verificação", exact: true })).toHaveCount(0);

        const lista = page.getByTestId("confianca-lista");
        for (const chave of ["email", "celular", "identidade", "duas-etapas", "senha"]) await expect(lista.getByTestId(`confianca-${chave}`)).toHaveCount(1);
        await expect(lista.getByTestId("confianca-identidade")).toContainText("Em breve");
        await expect(lista.getByTestId("confianca-linkedin")).toHaveCount(persona === "inquilino" ? 1 : 0);
        await expect(lista.getByTestId("confianca-senha").getByRole("link")).toHaveAttribute("href", "/dashboard/conta/seguranca");

        await expect(page.getByTestId("ver-como-outros-veem")).toBeVisible();
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
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const largura of [390, 1280]) {
    test(`${largura}px — /tributario com outros rendimentos e custo da empresa; cadastro sem simulador`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/tributario", { waitUntil: "networkidle" });
      await expect(page.getByText("Simulador tributário PF × PJ")).toBeVisible();
      await expect(page.getByTestId("tax-outros-rendimentos")).toBeVisible();
      const corpo = await page.locator("body").innerText();
      expect(corpo).not.toMatch(/Lucro presumido \+ IBS\/CBS|ago\/2026/);
      await expect(page.getByTestId("tax-resultado")).toContainText("custo de manter a empresa");
      // Aviso de IBS/CBS segue desligado até a revisão.
      await expect(page.getByTestId("tax-aviso-ibs-cbs")).toHaveCount(0);
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t192-tributario-${largura}.png`, fullPage: true });

      await page.goto("/auth?cadastro=1&papel=owner", { waitUntil: "networkidle" });
      expect(await page.locator("body").innerText()).not.toContain("Simulador tributário PF × PJ");
    });
  }
});
