import { test, expect } from "@playwright/test";

/*
  T914 — E621 (prova ao vivo de 05/11): em /comparar cada coluna da tabela abre com o bloco da foto principal do imóvel,
  na proporção dos cartões do site (4:3) — com a foto carregada ou, sem foto, o espaço reservado padrão; nunca uma coluna
  sem o bloco. 390 e 1280. Usa os anúncios de exemplo; se o ambiente não os tiver, a comparação cai no estado vazio e o
  teste se pula (nunca passa em falso).
  Varredura 16: as colunas dividem a largura por igual — as fotos ficam da mesma altura (a 768 eram 143/131/119 px).
*/
for (const w of [1280, 768, 390] as const) {
  test.describe(`T914 — E621 a ${w} px`, () => {
    test.use({ viewport: { width: w, height: 900 } });

    test("cada coluna tem o bloco da foto 4:3 (foto carregada ou espaço reservado)", async ({ page }) => {
      await page.goto("/comparar?comparar=ube-001,ube-002,ube-003", { waitUntil: "networkidle" });
      test.skip((await page.getByTestId("comparar-vazio").count()) > 0, "sem os anúncios de exemplo neste ambiente");
      const colunas = page.getByTestId("comparar-coluna");
      await expect(colunas.first()).toBeVisible({ timeout: 30_000 });
      const n = await colunas.count();
      expect(n).toBeGreaterThanOrEqual(2);
      for (let i = 0; i < n; i++) {
        const bloco = colunas.nth(i).getByTestId("comparar-foto");
        await expect(bloco, `coluna ${i + 1} com o bloco da foto`).toHaveCount(1);
        const m = await bloco.evaluate((el) => {
          const caixa = (el.firstElementChild as HTMLElement).getBoundingClientRect();
          const img = el.querySelector("img");
          return { razao: caixa.width / caixa.height, foto: !!img, carregou: !!img && img.complete && img.naturalWidth > 0 };
        });
        expect(Math.abs(m.razao - 4 / 3), `coluna ${i + 1}: 4:3`).toBeLessThan(0.03);
        if (m.foto) await expect.poll(() => bloco.locator("img").first().evaluate((im: HTMLImageElement) => im.complete && im.naturalWidth > 0), { timeout: 15_000 }).toBe(true);
      }
      const alturas = await colunas.evaluateAll((cs) => cs.map((c) => Math.round(c.querySelector('[data-testid="comparar-foto"]')!.firstElementChild!.getBoundingClientRect().height)));
      expect(Math.max(...alturas) - Math.min(...alturas), `fotos da mesma altura: ${alturas.join("/")}`).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `tests/laboratorio/saida/t914-e621-${w}.png` });
    });
  });
}
