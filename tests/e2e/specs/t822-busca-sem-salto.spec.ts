import { test, expect } from "@playwright/test";

/*
  T822 — estabilidade da /buscar (02/11, Pista A): a lista não "pula" quando o mapa entra. Antes: layout shift 0,30 a
  1280 px (os cartões encolhiam de 400 para 228 px depois do 1º desenho). Exige < 0,1 (o limite bom) a 1024 e 1280, e
  continua sem mapa no celular.
*/
for (const largura of [390, 1024, 1280] as const) {
  test(`T822 — /buscar sem salto de layout (${largura} px)`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
    await ctx.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((l) => {
        for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
          if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    const page = await ctx.newPage();
    await page.goto("/buscar", { waitUntil: "networkidle" });
    await expect(page.getByTestId("busca-lista")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(2500);
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    expect(cls).toBeLessThan(0.1);
    if (largura === 390) await expect(page.getByTestId("busca-mapa")).toBeHidden();
    else await expect(page.getByTestId("busca-mapa")).toBeVisible();
    await ctx.close();
  });
}
