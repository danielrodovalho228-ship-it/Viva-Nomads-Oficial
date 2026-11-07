import { test, expect } from "@playwright/test";
import { contagemDaBusca } from "../../../src/lib/busca/titulo-busca";

/**
 * T1285 — guarda do E446 (reprovas de 06/11): a página da cidade e a busca contam o MESMO fato. `/cidades/uberlandia` dizia
 * "15 anúncios de exemplo" (ou "9 imóveis + 6 de exemplo") enquanto a busca dizia "9 imóveis em Uberlândia": números e frases
 * diferentes para a mesma lista. A regra: a cidade usa `contagemDaBusca` (a mesma frase da busca) e o número bate com os
 * cartões que ela lista. A correção de produto está nos PRs #2970 e #2971 (Pistas A/B); esta spec é só a guarda, a 390 e 1280.
 */
const CIDADE = "Uberlândia";
const FRASE = /(\d+) imóveis? em Uberlândia/;

for (const w of [390, 1280] as const) {
  test(`E446: o título da cidade tem a frase e o número da busca, e bate com os cartões (${w})`, async ({ browser }) => {
    // E446 (reprova de 06/11), reproduzido no laboratório (run 42261458925, main): a busca diz "23 imóveis em Uberlândia" e a cidade
    // diz "23 imóveis + 15 de exemplo em Uberlândia". Corrigido nos PRs #2970/#2971 (rascunho). Quando entrarem, esta marca
    // vira "passou inesperadamente" e deve ser REMOVIDA — a spec fica como guarda permanente.
    test.fail(true, "E446: a cidade ainda soma 'de exemplo' no título (corrigido nos PRs #2970 e #2971)");
    const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
    try {
      const p = await ctx.newPage();
      await p.goto(`/buscar?local=${encodeURIComponent(CIDADE)}`, { waitUntil: "domcontentloaded" });
      const naBusca = p.getByText(FRASE).first();
      await expect(naBusca).toBeVisible({ timeout: 30_000 });
      const textoBusca = (await naBusca.innerText()).match(FRASE)![0];

      await p.goto("/cidades/uberlandia", { waitUntil: "domcontentloaded" });
      const titulo = p.getByRole("heading", { level: 2 }).filter({ hasText: /em Uberlândia$/ }).first();
      await expect(titulo).toBeVisible({ timeout: 30_000 });
      const textoCidade = (await titulo.innerText()).trim();
      console.log(`E446|${w}|busca="${textoBusca}"|cidade="${textoCidade}"`);

      // Mesma frase da busca (nada de "de exemplo" no título; reais × exemplo só no detalhe).
      const n = Number(textoCidade.match(/^(\d+)/)?.[1]);
      expect(textoCidade, "a cidade usa a frase da busca").toBe(contagemDaBusca({ n, local: CIDADE }));
      // O número do título é o da busca…
      expect(textoBusca, "o número da cidade é o da busca").toBe(textoCidade);
      // …e é o que a página lista.
      await expect(p.getByTestId("cidade-imoveis").locator("> *")).toHaveCount(n);
      expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    } finally {
      await ctx.close();
    }
  });
}
