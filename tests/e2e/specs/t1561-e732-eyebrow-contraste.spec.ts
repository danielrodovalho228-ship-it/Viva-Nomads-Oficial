import { test, expect } from "@playwright/test";

/*
  T1561 — E732 (#3530): o rótulo verde ("eyebrow") do topo de /empresas lê com contraste mínimo de 4,5:1 sobre o que está atrás dele
  de verdade (medido em pixels nas duas pontas internas da pastilha, com a foto já carregada), a 1280 e a 390 px. Antes: 3,60:1. Visitante.
*/
test.use({ storageState: { cookies: [], origins: [] } });

for (const [w, h] of [[1280, 900], [390, 844]] as const) {
  test(`a ${w} px: o rótulo do topo de /empresas tem contraste ≥ 4,5:1`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/empresas", { waitUntil: "load" });
    const rotulo = page.locator('[data-testid="banner-topo-coluna"] p.text-green-300').first();
    await expect(rotulo).toBeVisible({ timeout: 30_000 });
    await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 30_000 });
    await rotulo.scrollIntoViewIfNeeded();
    const cor = await rotulo.evaluate((el) => getComputedStyle(el).color.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number));
    const caixa = (await rotulo.boundingBox())!;
    const pngs: string[] = [];
    // sem texto nas pontas internas (o padding horizontal da pastilha): 2×2 px colados em cada lado, na altura do meio
    for (const x of [caixa.x + 2, caixa.x + caixa.width - 4]) {
      pngs.push((await page.screenshot({ clip: { x, y: caixa.y + caixa.height / 2 - 1, width: 2, height: 2 } })).toString("base64"));
    }
    const pior = await page.evaluate(
      async ({ pngs, cor }) => {
        const lum = (c: number[]) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
        let pior = 99;
        for (const b64 of pngs) {
          const im = new Image();
          im.src = `data:image/png;base64,${b64}`;
          await im.decode();
          const cv = document.createElement("canvas");
          cv.width = im.width; cv.height = im.height;
          const cx = cv.getContext("2d")!;
          cx.drawImage(im, 0, 0);
          const d = cx.getImageData(0, 0, im.width, im.height).data;
          for (let i = 0; i < d.length; i += 4) {
            const [x, y] = [lum([d[i], d[i + 1], d[i + 2]]), lum(cor)].sort((p, q) => q - p);
            pior = Math.min(pior, (x + 0.05) / (y + 0.05));
          }
        }
        return pior;
      },
      { pngs, cor },
    );
    expect(pior, `contraste do rótulo (cor ${cor.join(",")}) com o fundo`).toBeGreaterThanOrEqual(4.5);
  });
}
