import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/*
  Ordem 9f3085d8 — painel logado no padrão do rebuild: cada tela principal abre com
  uma capa fotográfica full-width (foto carregada, título visível), nenhuma foto se
  repete entre telas, sem rolagem horizontal, e as grades de cards têm colunas pares
  com cards da mesma altura. Desktop (1440) e mobile (390).
*/
const DONO = ["/dashboard/imoveis", "/dashboard/leads", "/dashboard/pedidos-cidade", "/dashboard/fechamento", "/dashboard/contratos", "/dashboard/garantias", "/dashboard/conta", "/dashboard/verificacao", "/dashboard/notificacoes", "/dashboard/solicitacoes", "/dashboard/ferramentas", "/dashboard/simulador", "/dashboard/roi-imovel", "/dashboard/viabilidade", "/dashboard/orcamentos"];
const MORADOR = ["/dashboard/favoritos", "/dashboard/buscas", "/dashboard/pedidos", "/dashboard/candidaturas", "/dashboard/locacoes", "/dashboard/avaliacoes", "/dashboard/indicacoes", "/dashboard/comparar"];

async function conferirCapa(page: Page, rota: string, largura: number) {
  await page.goto(rota, { waitUntil: "domcontentloaded" });
  const capa = page.getByTestId("painel-capa").first();
  await expect(capa, `${rota}: capa`).toBeVisible({ timeout: 20_000 });
  await expect(capa.locator("h1"), `${rota}: título na capa`).toBeVisible();
  const foto = capa.locator("img").first();
  await expect
    .poll(() => foto.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0), { message: `${rota}: foto carregou`, timeout: 15_000 })
    .toBe(true);
  // Capa ocupa toda a largura do conteúdo e tem altura de faixa (não é um título solto).
  const caixa = await capa.boundingBox();
  expect(caixa!.height, `${rota}: altura da capa`).toBeGreaterThanOrEqual(170);
  expect(caixa!.width, `${rota}: largura da capa`).toBeGreaterThan(largura > 500 ? 600 : 330);
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
  return foto.evaluate((i: HTMLImageElement) => new URL(i.currentSrc || i.src).searchParams.get("url") ?? i.src);
}

for (const [persona, rotas] of [["proprietario", DONO], ["inquilino", MORADOR]] as const) {
  test.describe(`painel ${persona}`, () => {
    test.use({ storageState: authFile(persona) });
    for (const largura of [1440, 390]) {
      test(`capas com foto única em todas as telas — ${largura}px`, async ({ page }) => {
        test.setTimeout(240_000);
        await page.setViewportSize({ width: largura, height: largura > 500 ? 900 : 844 });
        const fotos = new Map<string, string>();
        for (const rota of rotas) {
          const src = await conferirCapa(page, rota, largura);
          expect(fotos.get(src), `${rota} repete a foto de ${fotos.get(src)}`).toBeUndefined();
          fotos.set(src, rota);
        }
      });
    }
  });
}
