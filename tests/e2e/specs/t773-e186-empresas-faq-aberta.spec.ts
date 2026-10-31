import { test, expect } from "@playwright/test";

/*
  T773 — E186, regra do acordeão (#1687, Pista A): em /empresas as "Perguntas rápidas" são blocos abertos, a resposta à
  vista, sem <details>/<summary> (acordeão só nas páginas de tema da Central de Ajuda). Pista C, bloco 102. Pela página
  de verdade, como visitante: a 1280 px os três cartões ficam numa linha (o grid de 3 colunas do tablet para cima); a
  390 px um embaixo do outro. Em todas as larguras, a resposta de cada pergunta aparece sem clique.
*/
for (const largura of [1280, 390] as const) {
  test(`T773 — E186 a ${largura} px: /empresas mostra as Perguntas rápidas abertas, sem acordeão`, async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
    const page = await ctx.newPage();
    await page.goto("/empresas", { waitUntil: "domcontentloaded" });
    const faq = page.getByTestId("empresas-faq");
    await faq.scrollIntoViewIfNeeded();
    await expect(faq.getByRole("heading", { name: "Perguntas rápidas" })).toBeVisible();
    await expect(faq.locator("details, summary")).toHaveCount(0);
    const itens = faq.getByTestId("empresas-faq-item");
    const n = await itens.count();
    expect(n, "as perguntas da página").toBeGreaterThanOrEqual(3);
    for (let i = 0; i < n; i++) {
      await expect(itens.nth(i).locator("h3")).toBeVisible();
      await expect(itens.nth(i).locator("p")).toBeVisible(); // a resposta, sem clicar
    }
    const caixas = await itens.evaluateAll((els) => els.slice(0, 3).map((e) => e.getBoundingClientRect()).map((r) => ({ top: Math.round(r.top), left: Math.round(r.left) })));
    if (largura === 1280) {
      expect(new Set(caixas.map((c) => c.top)).size, "os três cartões numa linha").toBe(1);
    } else {
      expect(caixas[1].top, "um embaixo do outro").toBeGreaterThan(caixas[0].top);
      expect(caixas[2].top).toBeGreaterThan(caixas[1].top);
    }
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sobra, "sem rolagem lateral").toBeLessThanOrEqual(1);
    await ctx.close();
  });
}
