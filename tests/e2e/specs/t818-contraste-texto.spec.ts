import { test, expect, type Locator } from "@playwright/test";

/*
  T818 — contraste de texto (02/11, Pista A, WCAG AA 4,5:1): a trilha e o texto do cabeçalho verde da página do polo e
  o aviso de contato da página dos fotógrafos passam de 4,5:1. 390 e 1280.
*/
async function contraste(l: Locator): Promise<number> {
  return l.evaluate((e) => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 1;
    const cx = cv.getContext("2d")!;
    const rgba = (c: string) => {
      cx.clearRect(0, 0, 1, 1);
      cx.fillStyle = c;
      cx.fillRect(0, 0, 1, 1);
      const d = cx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2], d[3] / 255];
    };
    let n: Element | null = e;
    let fundo = [255, 255, 255];
    while (n) {
      const c = rgba(getComputedStyle(n).backgroundColor);
      if (c[3] >= 1) { fundo = c.slice(0, 3); break; }
      n = n.parentElement;
    }
    const t = rgba(getComputedStyle(e).color);
    const cor = t.slice(0, 3).map((v, i) => v * t[3] + fundo[i] * (1 - t[3]));
    const lum = (c: number[]) => {
      const f = (x: number) => ((x /= 255) <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    };
    const a = lum(cor), b = lum(fundo);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
}

for (const largura of [390, 1280] as const) {
  test(`T818 — contraste de texto ≥ 4,5:1 (${largura} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const r = await page.goto("/cidades/uberlandia/hc-ufu-umuarama", { waitUntil: "domcontentloaded" });
    if (r && r.status() < 400) {
      const trilha = page.locator("section.bg-forest nav").first();
      await expect(trilha).toBeVisible({ timeout: 30_000 });
      expect(await contraste(trilha)).toBeGreaterThanOrEqual(4.5);
      const publico = page.locator("section.bg-forest p.max-w-2xl").first();
      if (await publico.count()) expect(await contraste(publico)).toBeGreaterThanOrEqual(4.5);
    }
    const f = await page.goto("/parceiros/fotografos", { waitUntil: "domcontentloaded" });
    test.skip(!f || f.status() >= 400, "Sem a página de fotógrafos neste ambiente.");
    const aviso = page.getByTestId("fotografos-contato-aceite");
    await expect(aviso).toBeVisible({ timeout: 30_000 });
    expect(await contraste(aviso)).toBeGreaterThanOrEqual(4.5);
  });
}
