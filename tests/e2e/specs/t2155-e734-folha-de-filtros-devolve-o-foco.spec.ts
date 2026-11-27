import { test, expect, type Page } from "@playwright/test";

/*
  T2155 — E734 @E734: fechar a folha "Mais filtros" devolve o foco ao botão que a abriu (WCAG 2.4.3).
  Regra decidida (E734; correção e unitário no #3533: src/components/ui/bottom-sheet.tsx guarda quem abriu a folha e lhe
  devolve o foco ao fechar — Esc, fundo, X ou aplicar; unitário src/components/ui/e734-folha-devolve-o-foco.test.ts).
  Antes, ao fechar a folha o foco ia para o começo da página ("Pular para o conteúdo") e quem navega pelo teclado perdia o
  lugar. Visitante, só leitura: /buscar, a 1280 e a 390 px. A folha abre pelo teclado (foco no botão + Enter), fecha por
  Esc e pelo X, e depois de cada fecho o foco tem de estar de novo no botão "Mais filtros" (pilula-mais).
  Trava: vermelha na main até o #3533 entrar; verde com ele.
*/
test.use({ storageState: { cookies: [], origins: [] } });

async function abrirPeloTeclado(page: Page) {
  const botao = page.getByTestId("pilula-mais").first();
  const folha = page.getByTestId("painel-filtros");
  // O botão existe antes da hidratação: repete foco + Enter até a folha abrir.
  await expect(async () => {
    if (!(await folha.isVisible())) {
      await botao.focus();
      await page.keyboard.press("Enter");
    }
    await expect(folha).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  return { botao, folha };
}

test.describe("T2155 — E734: a folha de filtros devolve o foco a quem a abriu @E734", () => {
  for (const largura of [1280, 390] as const) {
    test(`${largura} px — fechar por Esc e pelo X devolve o foco ao botão "Mais filtros"`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto("/buscar", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("card-resultado").first()).toBeVisible({ timeout: 30_000 });

      // 1. Esc.
      let { botao, folha } = await abrirPeloTeclado(page);
      await page.keyboard.press("Escape");
      await expect(folha, "Esc fecha a folha").toHaveCount(0);
      await expect(botao, "depois do Esc o foco volta ao botão que abriu a folha").toBeFocused();

      // 2. O X ("Fechar").
      ({ botao, folha } = await abrirPeloTeclado(page));
      await folha.getByRole("button", { name: "Fechar" }).click();
      await expect(folha, "o X fecha a folha").toHaveCount(0);
      await expect(botao, "depois do X o foco volta ao botão que abriu a folha").toBeFocused();
    });
  }
});
