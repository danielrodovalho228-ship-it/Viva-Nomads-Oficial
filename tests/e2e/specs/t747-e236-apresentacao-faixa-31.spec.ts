import { test, expect } from "@playwright/test";

/*
  T747 — E236 (varredura, #1649): a /apresentacao (slideshow estático, public/apresentacao.html) não chama mais a faixa
  31+ da taxa de "Plano Gestor"; a linha é "31+ imóveis · taxa negociável" (E252-B), com "negociado · 6% até lá".
  Pista C, bloco 84. Pela página de verdade, a 1280 e a 390 px: abre o slide "Modelo de receita" pelo ponto da
  navegação e confere a tabela VISÍVEL, faixa por faixa; em nenhum slide "Gestor" aparece com o 31 ou com um número fixo
  de imóveis. A página segue fora dos buscadores (X-Robots-Tag noindex) e a URL limpa não pede a senha dos sócios.
*/
const SAIDA = "tests/laboratorio/saida";
const FAIXAS: [string, string][] = [
  ["1–2 imóveis", "12%"],
  ["3–5 imóveis", "10%"],
  ["6–15 imóveis", "8%"],
  ["16–30 imóveis", "6%"],
  ["31+ imóveis · taxa negociável", "negociado · 6% até lá"],
];

test.describe("T747 — E236: /apresentacao chama a faixa 31+ de 'taxa negociável', sem 'Plano Gestor'", () => {
  test("cabeçalho: a URL limpa responde 200 sem pedir a senha e fica fora dos buscadores", async ({ request }) => {
    const r = await request.get("/apresentacao", { maxRedirects: 0 });
    expect(r.status()).toBe(200);
    expect(r.headers()["x-robots-tag"] ?? "").toContain("noindex");
    const html = await r.text();
    expect(html).toContain("<span>31+ imóveis · taxa negociável</span>");
    expect(html).not.toContain("Plano Gestor");
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — o slide 'Modelo de receita' mostra as 5 faixas e a 31+ como taxa negociável`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 800 });
      await page.goto("/apresentacao", { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/apresentacao$/);
      const slides = page.locator("#stage .slide");
      await expect(slides.first()).toBeAttached();
      const indice = await slides.evaluateAll((els) => els.findIndex((e) => /Modelo de receita/.test(e.textContent ?? "")));
      expect(indice, "o slide 'Modelo de receita' existe").toBeGreaterThanOrEqual(0);
      // O ponto da navegação leva ao slide (no celular os pontos podem ficar fora da tela: clique pelo DOM).
      await page.locator("#dots .dot").nth(indice).evaluate((d: HTMLElement) => d.click());
      const slide = slides.nth(indice);
      await expect(slide).toHaveClass(/active/);

      const linhas = slide.locator(".rev .row");
      for (const [faixa, taxa] of FAIXAS) {
        const linha = linhas.filter({ has: page.locator("span", { hasText: faixa }) });
        await expect(linha, faixa).toHaveCount(1);
        await expect(linha, faixa).toBeVisible();
        await expect(linha.locator("b")).toHaveText(taxa);
      }
      await expect(slide).not.toContainText("Gestor");

      // Nenhum slide liga "Gestor" ao 31 ou a um número fixo de imóveis.
      const frases = await slides.evaluateAll((els) => els.map((e) => (e.textContent ?? "").replace(/\s+/g, " ")));
      for (const f of frases) expect(f).not.toMatch(/Gestor[^.]{0,40}\b\d+\+?\s*imóveis|\d+\+?\s*imóveis[^.]{0,40}Gestor/);
      await page.screenshot({ path: `${SAIDA}/t747-receita-${largura}.png` });
    });
  }
});
