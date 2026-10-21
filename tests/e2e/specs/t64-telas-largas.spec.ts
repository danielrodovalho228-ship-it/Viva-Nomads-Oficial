import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T64 — ordem bbced3fa (parte 2): a área logada usa a largura cheia, igual à Visão geral.
 * (1) a 1280 e 1920 px o conteúdo de cada rota tem a mesma largura da Visão geral (±24 px);
 * (2) a 360 e 390 px nenhuma rota rola para o lado;
 * (3) "Anunciar" (novo) tem 2 colunas no computador (etapa + resumo) e 1 no celular.
 */
const ROTAS = [
  "/dashboard",
  "/dashboard/imoveis",
  "/dashboard/imoveis/novo",
  "/dashboard/mensagens",
  "/dashboard/locacoes",
  "/dashboard/contratos",
  "/dashboard/carteira",
  "/dashboard/conta",
  "/dashboard/notificacoes",
  "/dashboard/solicitacoes",
];

test.use({ storageState: authFile("proprietario") });

/** Abre a rota sem esperar "networkidle" (nunca assenta no painel) e espera o <main> aparecer. */
async function abrir(page: Page, rota: string) {
  await page.goto(rota, { waitUntil: "domcontentloaded" });
  await page.locator("main").first().waitFor();
}

/**
 * Largura do maior bloco direto dentro do <main> (o conteúdo da página).
 * Espera o conteúdo existir: /dashboard/locacoes do dono sem estadia redireciona para Contratos (prompt 28) e,
 * com a página em streaming, o <main> do primeiro render ainda não tem filhos (lab 5d5f433e: 0px).
 */
async function larguraConteudo(page: Page): Promise<number> {
  const medir = () =>
    page.evaluate(() => {
      const main = document.querySelector("main");
      if (!main) return 0;
      return Math.round(Math.max(0, ...Array.from(main.children).map((c) => c.getBoundingClientRect().width)));
    });
  await expect.poll(medir, { timeout: 15_000, message: "conteúdo do <main> não apareceu" }).toBeGreaterThan(0);
  return medir();
}

// Uma rota por teste: as 10 rotas em sequência estouravam os 135 s de um teste só quando o lab estava lento
// (lab fe04ddf6: T64 1280 px por timeout). Cada teste mede a Visão geral e a própria rota, com prazo próprio.
for (const largura of [1280, 1920]) {
  for (const rota of ROTAS.slice(1)) {
    test(`T64 — ${rota} em largura cheia a ${largura}px (±24 px da Visão geral)`, async ({ page }) => {
      test.slow();
      await page.setViewportSize({ width: largura, height: 900 });
      await abrir(page, "/dashboard");
      const referencia = await larguraConteudo(page);
      expect(referencia).toBeGreaterThan(largura * 0.6);
      await abrir(page, rota);
      const w = await larguraConteudo(page);
      expect(Math.abs(w - referencia), `${rota}: ${w}px contra ${referencia}px da Visão geral`).toBeLessThanOrEqual(24);
    });
  }
}

for (const largura of [360, 390]) {
  test(`T64 — sem rolagem lateral a ${largura}px nas ${ROTAS.length} rotas`, async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: largura, height: 800 });
    for (const rota of ROTAS) {
      await abrir(page, rota);
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(sobra, `${rota} rola ${sobra}px para o lado`).toBeLessThanOrEqual(1);
    }
  });
}

test("T64 — novo anúncio: etapa à esquerda e resumo à direita a 1280px; uma coluna a 390px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await abrir(page, "/dashboard/imoveis/novo");
  const resumo = page.getByTestId("novo-resumo");
  await expect(resumo).toBeVisible();
  const grade = page.getByTestId("novo-duas-colunas");
  const g = (await grade.boundingBox())!;
  const r = (await resumo.boundingBox())!;
  expect(r.x).toBeGreaterThan(g.x + g.width * 0.6); // resumo na coluna da direita
  const etapa = (await grade.locator("> div").first().boundingBox())!;
  expect(etapa.x + etapa.width).toBeLessThanOrEqual(r.x); // lado a lado, sem sobrepor
  await page.setViewportSize({ width: 390, height: 800 });
  await page.waitForTimeout(300);
  const g2 = (await grade.boundingBox())!;
  const r2 = (await resumo.boundingBox())!;
  expect(r2.y).toBeGreaterThan(g2.y + 100); // empilhado embaixo da etapa
  expect(Math.abs(r2.x - g2.x)).toBeLessThanOrEqual(2);
});
