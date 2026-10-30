import { test, expect, type Page } from "@playwright/test";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T730 — conformidade visual da HOME (passada final, 30/10), a 1280 e 390:
   1. o selo "Internet para home office" fica dentro da foto (antes saía da coluna: -right-4 -top-4);
   2. os atalhos ("Encontre o imóvel do seu jeito") começam na mesma coluna das outras seções e o título fica à
      esquerda, como os demais;
   3. os títulos de seção da home têm o mesmo tamanho ("A Viva em 30 segundos" e "Encontre o imóvel do seu jeito"
      eram 24 e 20 px; os outros, 28 px no desktop e 22 px no celular);
   4. a varredura do protocolo (seis classes) não acha nada.
*/
const SAIDA = "tests/laboratorio/saida";

const caixa = (p: Page, sel: string) => p.locator(sel).first().evaluate((el) => {
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top + scrollY), b: Math.round(r.bottom + scrollY), fonte: cs.fontSize, alinhado: cs.textAlign };
});

test.describe("T730 — conformidade da home", () => {
  for (const largura of [1280, 390] as const) {
    test(`${largura} px: selo dentro da foto, atalhos na coluna, títulos de seção iguais, varredura limpa`, async ({ browser }) => {
      test.setTimeout(150_000);
      const ctx = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const p = await ctx.newPage();
      const respostas = escutarImagens(p);
      await p.goto("/", { waitUntil: "domcontentloaded" });
      await p.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

      // 1. Selo dentro da foto (achado pelo texto: o mesmo seletor na main e no branch).
      const seloEl = p.getByText("Internet para home office", { exact: true }).locator("xpath=..");
      const selo = await seloEl.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top + scrollY) };
      });
      const foto = await seloEl.locator("xpath=..").evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top + scrollY), b: Math.round(r.bottom + scrollY) };
      });
      expect(selo.l).toBeGreaterThanOrEqual(foto.l);
      expect(selo.r, "o selo não passa da borda direita da foto").toBeLessThanOrEqual(foto.r);
      expect(selo.t, "o selo não passa da borda de cima da foto").toBeGreaterThanOrEqual(foto.t);

      // 2. Atalhos na coluna das outras seções; título à esquerda.
      const referencia = await caixa(p, '[data-testid="secao-video-institucional"] h2');
      const atalhos = p.getByTestId("atalhos-categoria");
      if (await atalhos.count()) {
        const grade = await caixa(p, '[data-testid="atalhos-categoria"]');
        const titulo = await caixa(p, "#atalhos-titulo");
        expect(grade.l, "a grade de atalhos começa na coluna da página").toBe(referencia.l);
        expect(titulo.l).toBe(referencia.l);
        expect(titulo.alinhado).not.toBe("center");
        expect(titulo.fonte).toBe(referencia.fonte);
      }

      // 3. Títulos de seção (h2 de texto escuro fora do hero) com o mesmo tamanho.
      const tamanhos = await p.locator("main h2").evaluateAll((hs) =>
        hs.filter((h) => h.getBoundingClientRect().height > 0 && !h.closest('[data-testid="hero-home"]')).map((h) => getComputedStyle(h).fontSize),
      );
      expect(new Set(tamanhos).size, `tamanhos dos títulos de seção: ${tamanhos.join(", ")}`).toBe(1);
      expect(referencia.fonte).toBe(largura === 1280 ? "28px" : "22px");

      // 4. Varredura do protocolo.
      const achados = await varrerPagina(p, respostas);
      for (const c of Object.keys(CLASSES) as Classe[]) expect.soft(achados[c], `home ${largura} — ${CLASSES[c]}`).toEqual([]);

      await seloEl.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t730-home-selo-${largura}.png` });
      if (await atalhos.count()) {
        await p.locator("#atalhos-titulo").scrollIntoViewIfNeeded();
        await p.screenshot({ path: `${SAIDA}/t730-home-atalhos-${largura}.png` });
      }
      await ctx.close();
    });
  }
});
