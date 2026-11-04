import { test, expect } from "@playwright/test";

/*
  T843 — E528 (D14, QA de cliques do morador 02/11): o painel de preço do anúncio fica fixo ao rolar SEM rolagem interna
  (antes: altura máxima + overflow, com 750–850 px escondidos dentro dele em 1280). Rolando só a página, o preço no topo
  do painel e o ÚLTIMO bloco visível dele (a base, onde ficavam os campos cortados, como "Motivo da estadia" quando
  aparece) ficam inteiros e na frente em algum momento. 1280 (janela de 800) e 390.
*/
for (const [largura, altura] of [[1280, 800], [390, 844]] as const) {
  test.describe(`T843 — E528 (${largura}x${altura})`, () => {
    test.use({ viewport: { width: largura, height: altura } });

    test("painel de preço sem rolagem própria; o preço do topo e a base alcançáveis só rolando a página", async ({ page }) => {
      test.setTimeout(90_000);
      await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
      await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });
      const painel = page.locator("#cartao-preco");
      await expect(painel).toBeVisible();
      // Espera a hidratação: o "top" do painel passa a seguir a regra (preso no topo se cabe; pela base se não cabe).
      await expect
        .poll(() =>
          painel.evaluate((c: HTMLElement) => {
            const h = c.offsetHeight;
            const esperado = h + 144 + 16 <= innerHeight ? 144 : innerHeight - h - 16;
            return parseFloat(getComputedStyle(c).top) === esperado;
          }),
          { timeout: 15_000, message: "o painel mede a própria altura e ajusta o top" }
        )
        .toBe(true);
      const estilo = await painel.evaluate((c) => ({ scrollInterno: c.scrollHeight - c.clientHeight, overflowY: getComputedStyle(c).overflowY, maxH: getComputedStyle(c).maxHeight }));
      expect(estilo).toEqual({ scrollInterno: 0, overflowY: "visible", maxH: "none" });

      const r = await page.evaluate(async () => {
        const c = document.getElementById("cartao-preco")!;
        const preco = c.querySelector('[data-testid="cartao-lateral-preco"]')!;
        // o último bloco VISÍVEL do painel (campos escondidos até a escolha das datas não contam)
        const blocos = [...c.querySelectorAll<HTMLElement>("p, label, button, a, input, select, textarea")].filter((e) => e.getBoundingClientRect().height > 0);
        const base = blocos.reduce((a, e) => (e.getBoundingClientRect().bottom > a.getBoundingClientRect().bottom ? e : a));
        const visivel = (e: Element) => {
          const r = e.getBoundingClientRect();
          if (r.top < 0 || r.bottom > innerHeight) return false;
          const no = document.elementFromPoint(r.left + Math.min(r.width / 2, 20), r.top + r.height / 2);
          return !!no && (e === no || e.contains(no));
        };
        let viuPreco = false;
        let viuBase = false;
        for (let y = 0; y < document.documentElement.scrollHeight; y += 50) {
          scrollTo(0, y);
          await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
          if (visivel(preco)) viuPreco = true;
          if (visivel(base)) viuBase = true;
          if (viuPreco && viuBase) break;
        }
        return { viuPreco, viuBase, base: base.textContent?.trim().slice(0, 40) };
      });
      expect(r.viuPreco, "o preço/total do topo do painel aparece inteiro").toBe(true);
      expect(r.viuBase, `a base do painel ("${r.base}") aparece inteira`).toBe(true);
      expect(await page.evaluate((l) => document.documentElement.scrollWidth - l, largura)).toBeLessThanOrEqual(1);
    });
  });
}
