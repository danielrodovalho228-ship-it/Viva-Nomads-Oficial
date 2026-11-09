import { test, expect } from "@playwright/test";

/**
 * T1597 — GUARDA DO E732 (#3530, merge na main em 09/11): o rótulo do banner de topo ("Para empresas") não fica mais direto
 * sobre a foto (3,60:1): vai numa pastilha escura própria (night/80) com texto branco a 90%, e o contraste passa de 4,5:1 mesmo
 * com a foto mais clara possível por baixo. Medida no navegador, em /empresas a 390 e 1280 px: as cores calculadas do texto e da
 * pastilha são compostas sobre BRANCO (pior caso da foto) e a razão de contraste tem de ser ≥ 4,5. Páginas públicas, sem login.
 */
for (const largura of [390, 1280]) {
  test.describe(`T1597 — E732: rótulo do banner com contraste (${largura}px)`, () => {
    test.use({ viewport: { width: largura, height: 900 } });

    test("/empresas: o rótulo está numa pastilha escura e passa de 4,5:1 sobre a pior foto", async ({ page }) => {
      await page.goto("/empresas", { waitUntil: "domcontentloaded" });
      const rotulo = page.getByTestId("banner-topo-eyebrow").first();
      await expect(rotulo).toBeVisible({ timeout: 30_000 });
      await expect(rotulo).toHaveText("Para empresas");

      const medida = await rotulo.evaluate((el) => {
        const rgba = (s: string) => {
          const m = s.match(/rgba?\(([^)]+)\)/);
          if (!m) return [0, 0, 0, 1];
          const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
          return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
        };
        const sobre = (fg: number[], bg: number[]) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]));
        const lum = (c: number[]) => {
          const [r, g, b] = c.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const estilo = getComputedStyle(el);
        const fundo = rgba(estilo.backgroundColor);
        const texto = rgba(estilo.color);
        const branco = [255, 255, 255, 1];
        const pastilha = sobre(fundo, branco); // pior caso: a foto atrás é branca
        const cor = sobre(texto, [...pastilha, 1]);
        const a = lum(cor);
        const b = lum(pastilha);
        return { razao: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), alfaFundo: fundo[3], raio: estilo.borderTopLeftRadius };
      });
      expect(medida.alfaFundo, "a pastilha tem fundo próprio (não é texto direto sobre a foto)").toBeGreaterThan(0.5);
      expect(medida.razao, `contraste ${medida.razao.toFixed(2)}:1 com a foto branca por baixo`).toBeGreaterThanOrEqual(4.5);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  });
}
