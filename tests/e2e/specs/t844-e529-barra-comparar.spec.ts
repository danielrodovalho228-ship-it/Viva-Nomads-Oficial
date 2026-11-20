import { test, expect } from "@playwright/test";

/*
  T844 — E529 (D15, QA de cliques do morador 02/11; 3ª reprova de 06/11): a barra "Comparar (2)" não flutua sobre os
  cartões — é uma faixa NORMAL da página, acima da lista (sem sticky/fixed): em NENHUM ponto da rolagem ela cobre um cartão
  e toda caixinha "Comparar" segue clicável. 1280 e 390.
*/
for (const largura of [1280, 390] as const) {
  test.describe(`T844 — E529 (${largura}px)`, () => {
    test.use({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });

    test("barra encaixada: sem cartão ao lado, nada por baixo no fim, caixinhas clicáveis", async ({ page }) => {
      test.setTimeout(120_000);
      await page.goto("/buscar", { waitUntil: "networkidle" });
      await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });
      const caixas = page.getByTestId("marcar-comparar");
      await caixas.nth(0).check();
      await caixas.nth(1).check();
      const barra = page.getByTestId("barra-comparar");
      await expect(barra).toContainText("Comparar (2)");
      expect(await barra.evaluate((e) => ({ pos: getComputedStyle(e).position, fundo: getComputedStyle(e).backgroundColor }))).toEqual({ pos: "static", fundo: "rgb(255, 255, 255)" });

      const r = await page.evaluate(async () => {
        const b = document.querySelector('[data-testid="barra-comparar"]')!;
        const cartoes = () => [...document.querySelectorAll('[data-testid="grade-resultados"] > *')].map((c) => c.getBoundingClientRect());
        let aoLado = 0;
        for (let y = 0; y < document.documentElement.scrollHeight; y += 120) {
          scrollTo(0, y);
          await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
          const rb = b.getBoundingClientRect();
          if (rb.top >= innerHeight || rb.bottom <= 0) continue;
          // nenhuma parte da barra sobre um cartão (qualquer sobreposição de retângulos conta)
          if (cartoes().some((r) => !(r.right <= rb.left || r.left >= rb.right || r.bottom <= rb.top || r.top >= rb.bottom))) aoLado++;
        }
        scrollTo(0, document.documentElement.scrollHeight);
        await new Promise((ok) => setTimeout(ok, 200));
        const rb = b.getBoundingClientRect();
        const porBaixoNoFim = cartoes().some((r) => !(r.right <= rb.left || r.left >= rb.right || r.bottom <= rb.top || r.top >= rb.bottom));
        return { aoLado, porBaixoNoFim };
      });
      expect(r).toEqual({ aoLado: 0, porBaixoNoFim: false });

      const n = await caixas.count();
      for (let i = 0; i < n; i++) await caixas.nth(i).click({ trial: true, timeout: 5_000 });
      expect(await page.evaluate((l) => document.documentElement.scrollWidth - l, largura)).toBeLessThanOrEqual(1);
      await barra.screenshot({ path: `tests/laboratorio/saida/t844-barra-${largura}.png` });
    });
  });
}
