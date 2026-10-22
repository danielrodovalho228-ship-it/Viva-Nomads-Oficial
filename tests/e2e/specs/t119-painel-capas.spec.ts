import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/*
  Ordem 9f3085d8 → Prompt 42, item 2: as telas logadas abrem com o título em texto (h1 + subtítulo), SEM a capa
  fotográfica que ocupava um quarto da tela sem informação. Continua: sem rolagem horizontal e grades de cards com
  número par de colunas. Desktop (1440) e mobile (390).
*/
const DONO = ["/dashboard/imoveis", "/dashboard/leads", "/dashboard/pedidos-cidade", "/dashboard/fechamento", "/dashboard/contratos", "/dashboard/garantias", "/dashboard/conta", "/dashboard/verificacao", "/dashboard/notificacoes", "/dashboard/solicitacoes", "/dashboard/ferramentas", "/dashboard/simulador", "/dashboard/roi-imovel", "/dashboard/orcamentos"];
const MORADOR = ["/dashboard/favoritos", "/dashboard/buscas", "/dashboard/pedidos", "/dashboard/candidaturas", "/dashboard/locacoes", "/dashboard/avaliacoes", "/dashboard/indicacoes", "/dashboard/comparar"];

async function conferirTitulo(page: Page, rota: string) {
  await page.goto(rota, { waitUntil: "domcontentloaded" });
  // Servidor do laboratório começa frio: a 1ª tela leva mais que as seguintes.
  await expect(page.locator("main h1:visible").first(), `${rota}: título`).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('[data-testid="painel-capa"]')).toHaveCount(0); // sem capa de foto
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(sobra, `${rota}: rolagem horizontal`).toBeLessThanOrEqual(1);
  // Grades do conteúdo: 1 coluna (empilhado) ou número par de colunas — nunca 3, 5…
  // (campos de formulário ficam de fora: são linhas de inputs, não grades de cards).
  const impares = await page.locator("main").first().evaluate((main) =>
    [...main.querySelectorAll<HTMLElement>("*")]
      .filter((el) => getComputedStyle(el).display === "grid" && !el.closest("form") && el.offsetParent !== null)
      // Linha só de campos (label/input/select) é formulário, não grade de cards.
      .filter((el) => ![...el.children].every((c) => c.matches("label, input, select, textarea")))
      .map((el) => ({ cols: getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length, cls: el.className }))
      .filter((g) => g.cols > 1 && g.cols % 2 === 1)
  );
  expect(impares, `${rota}: grade com colunas ímpares`).toEqual([]);
}

for (const [persona, rotas] of [["proprietario", DONO], ["inquilino", MORADOR]] as const) {
  test.describe(`painel ${persona}`, () => {
    test.use({ storageState: authFile(persona) });
    for (const largura of [1440, 390]) {
      test(`título em texto, sem capa de foto, em todas as telas — ${largura}px`, async ({ page }) => {
        test.setTimeout(240_000);
        await page.setViewportSize({ width: largura, height: largura > 500 ? 900 : 844 });
        for (const rota of rotas) await conferirTitulo(page, rota);
      });
    }
  });
}
