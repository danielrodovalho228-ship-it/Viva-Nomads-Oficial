import { test, expect } from "@playwright/test";
import { POLOS, tituloSeoDoPolo } from "../../../src/lib/polos";

/**
 * T1269 — Faixa C (#2953), 06/11: o título das páginas de polo cabe em 60 caracteres (o Google corta acima disso), com o
 * sufixo " · Viva Nomads" do layout, e mantém "Imóveis mobiliados" e o local. Entrou só com teste de unidade sobre a função;
 * aqui é o <title> que a página realmente serve, para cada polo cadastrado, a 390 e 1280 px (e sem rolagem lateral).
 */
test.describe("T1269 — título SEO dos polos (até 60 caracteres)", () => {
  for (const polo of POLOS) {
    for (const w of [390, 1280] as const) {
      test(`${polo.cidade}/${polo.slug} (${w})`, async ({ browser }) => {
        const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
        try {
          const p = await ctx.newPage();
          const r = await p.goto(`/cidades/${polo.cidade}/${polo.slug}`, { waitUntil: "domcontentloaded" });
          expect(r?.status(), "a página do polo abre").toBeLessThan(400);
          const titulo = await p.title();
          expect(titulo.length, `título de ${titulo.length} caracteres: ${titulo}`).toBeLessThanOrEqual(60);
          expect(titulo.startsWith("Imóveis mobiliados"), titulo).toBe(true);
          expect(titulo).toContain(polo.referencia.split(" e ")[0]);
          expect(titulo).toBe(`${tituloSeoDoPolo(polo)} · Viva Nomads`);
          expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
        } finally {
          await ctx.close();
        }
      });
    }
  }
});
