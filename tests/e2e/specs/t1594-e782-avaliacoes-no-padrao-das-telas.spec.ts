import { test, expect } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { abrirComoConta, temContaVarredura } from "../fixtures/varredura";

/**
 * T1594 — GUARDA DO E782 (#3617, merge na main em 09/11): a tela de Avaliações segue o padrão das outras telas — a SETA de voltar
 * junto do título (não o "← Voltar" em texto), título em tinta (não verde grande), abas SUBLINHADAS (não pílulas preenchidas) e
 * sem o título duplicado da aba ativa ("Para avaliar" / "Feitas" viram `region` com aria-label, não `h2`). Logado como a
 * inquilina da massa da varredura, em /dashboard/avaliacoes, a 390 e 1280 px. Só no laboratório.
 */
for (const tamanho of ["390", "1280"] as const) {
  test.describe(`T1594 — E782: Avaliações no padrão (${tamanho}px)`, () => {
    test.skip(!NO_LABORATORIO || !temContaVarredura("INQUILINA"), "precisa do laboratório e da conta INQUILINA da massa da varredura");

    test("seta de voltar, título em tinta, abas sublinhadas e sem título duplicado", async ({ browser }) => {
      test.setTimeout(120_000);
      const { context, page } = await abrirComoConta(browser, "INQUILINA", tamanho);
      try {
        await page.goto("/dashboard/avaliacoes", { waitUntil: "domcontentloaded", timeout: 40_000 });
        await expect(page.getByTestId("avaliacoes-painel")).toBeVisible({ timeout: 30_000 });
        expect(new URL(page.url()).pathname).toBe("/dashboard/avaliacoes");

        // Título em tinta (não na cor verde das abas ativas) e a seta de voltar junto dele.
        const h1 = page.getByTestId("avaliacoes-cabecalho").locator("h1");
        await expect(h1).toHaveText("Avaliações");
        const corTitulo = await h1.evaluate((e) => getComputedStyle(e).color);
        const corAbaAtiva = await page.locator('nav[aria-label="Avaliações"] a[aria-current="page"]').evaluate((e) => getComputedStyle(e).color);
        expect(corTitulo, "o título não é da cor verde da aba ativa").not.toBe(corAbaAtiva);
        await expect(page.getByTestId("avaliacoes-voltar")).toBeVisible();
        await expect(page.getByText("← Voltar")).toHaveCount(0);

        // Abas sublinhadas: borda embaixo de 2 px, sem pílula arredondada preenchida.
        const abas = page.locator('nav[aria-label="Avaliações"] a');
        expect(await abas.count(), "há abas").toBeGreaterThanOrEqual(2);
        for (const aba of await abas.all()) {
          const estilo = await aba.evaluate((e) => {
            const s = getComputedStyle(e);
            return { borda: s.borderBottomWidth, raio: s.borderTopLeftRadius, fundo: s.backgroundColor };
          });
          expect(estilo.borda, "a aba tem sublinhado de 2px").toBe("2px");
          expect(estilo.fundo, "a aba não é pílula preenchida").toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
        }

        // Sem título duplicado: "Para avaliar" e "Feitas" não são h2 dentro do corpo.
        await expect(page.getByRole("heading", { name: "Para avaliar", exact: true })).toHaveCount(0);
        await page.getByTestId("painel-aba-feitas").click();
        await expect(page.getByTestId("painel-feitas")).toBeVisible({ timeout: 20_000 });
        await expect(page.getByRole("heading", { name: "Feitas", exact: true })).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      } finally {
        await context.close();
      }
    });
  });
}
