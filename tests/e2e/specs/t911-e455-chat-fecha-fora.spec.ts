import { test, expect } from "@playwright/test";

/*
  T911 — E455 (ii), rodada pública 02/11: o painel flutuante "Fale com a Viva" aberto cobria o lado direito do rodapé e só
  saía pelo "Fechar". Agora: escrever dentro dele não fecha; tocar/clicar fora (no rodapé) fecha e o rodapé fica livre;
  Esc fecha e devolve o foco ao botão. 768 e 1280 (abaixo de 768 o flutuante não aparece — E246).
  A parte (i), a barra "Comparar" sobre os cartões, é o E529 (t844).
*/
for (const w of [1280, 768] as const) {
  test.describe(`T911 — E455: chat aberto sai do caminho a ${w} px`, () => {
    test.use({ viewport: { width: w, height: 900 } });

    test("dentro não fecha; fora fecha e libera o rodapé; Esc fecha e devolve o foco", async ({ page }) => {
      await page.goto("/como-funciona", { waitUntil: "networkidle" });
      const botao = page.getByTestId("fale-com-a-viva");
      const painel = page.getByRole("dialog", { name: "Chat com a Viva" });
      await expect(botao).toBeVisible({ timeout: 30_000 });
      // Antes de hidratar o clique não abre: tenta até o painel aparecer.
      await expect(async () => {
        if (!(await painel.isVisible())) await botao.click();
        await expect(painel).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 20_000 });

      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const campo = painel.locator("textarea, input").first();
      await campo.click();
      await campo.fill("Olá");
      await expect(painel).toBeVisible();

      // Fora (lado esquerdo do rodapé): fecha, e nada do flutuante fica sobre os links da direita do rodapé.
      const rodape = (await page.locator("footer").boundingBox())!;
      await page.mouse.click(rodape.x + 40, Math.min(rodape.y + 40, 880));
      await expect(painel).toHaveCount(0);
      const cobertos = await page.evaluate(() => {
        const raiz = document.querySelector('[data-testid="fale-com-a-viva-raiz"]');
        return [...document.querySelectorAll("footer a")].filter((a) => {
          const r = a.getBoundingClientRect();
          if (r.bottom < 0 || r.top > innerHeight || !r.width) return false;
          const no = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return !!no && !!raiz?.contains(no);
        }).length;
      });
      expect(cobertos, "links do rodapé sob o painel do chat").toBe(0);

      // Esc fecha e devolve o foco ao botão.
      await botao.click();
      await expect(painel).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(painel).toHaveCount(0);
      await expect(botao).toBeFocused();
      await page.screenshot({ path: `tests/laboratorio/saida/t911-e455-${w}.png` });
    });
  });
}
