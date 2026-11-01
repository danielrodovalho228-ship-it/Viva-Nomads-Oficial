import { test, expect } from "@playwright/test";

/*
  T933 — #2020 (Pista A, varredura 01/11): o número de cada passo em /como-funciona era sage-200 sobre o fundo (1,25:1;
  texto grande pede 3:1) e passou para a cor da marca (forest, ~6,4:1). Na tela de verdade, como visitante, a 390 e a
  1280 px: cada número de passo (1, 2, 3…) tem contraste ≥ 3:1 contra o fundo efetivo (a primeira cor de fundo opaca
  subindo pelos pais), medido pelas cores calculadas pelo navegador.
*/
const SAIDA = "tests/laboratorio/saida";

for (const largura of [390, 1280] as const) {
  test(`T933 — /como-funciona @${largura}: números dos passos com contraste ≥ 3:1`, async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
    const page = await ctx.newPage();
    const r = await page.goto("/como-funciona", { waitUntil: "domcontentloaded" });
    expect(r?.status() ?? 0).toBeLessThan(400);
    await page.locator("main").first().waitFor({ timeout: 30_000 });
    const medidas = await page.locator("main span.text-2xl").evaluateAll((els) => {
      const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
      const lum = ([r, g, b]: number[]) => {
        const f = (v: number) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const fundo = (e: Element | null): string => {
        for (let x = e; x; x = x.parentElement) {
          const c = getComputedStyle(x).backgroundColor;
          const v = rgb(c);
          if (v.length >= 3 && (v.length < 4 || v[3] > 0.9)) return c;
        }
        return "rgb(255, 255, 255)";
      };
      return els
        .filter((e) => /^\d+$/.test((e.textContent ?? "").trim()))
        .map((e) => {
          const cor = getComputedStyle(e).color;
          const bg = fundo(e.parentElement);
          const [a, b] = [lum(rgb(cor)), lum(rgb(bg))].sort((x, y) => y - x);
          return { n: (e.textContent ?? "").trim(), cor, bg, razao: Math.round(((a + 0.05) / (b + 0.05)) * 100) / 100 };
        });
    });
    console.log(`t933|${largura}|${JSON.stringify(medidas)}`);
    expect(medidas.length, "os números dos passos estão na tela").toBeGreaterThanOrEqual(3);
    for (const m of medidas) expect(m.razao, `passo ${m.n}: ${m.cor} sobre ${m.bg}`).toBeGreaterThanOrEqual(3);
    await page.screenshot({ path: `${SAIDA}/t933-como-funciona-${largura}.png` });
    await ctx.close();
  });
}
