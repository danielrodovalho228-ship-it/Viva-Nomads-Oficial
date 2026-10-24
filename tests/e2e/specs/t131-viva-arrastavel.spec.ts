import { test, expect } from "@playwright/test";

/**
 * T131 — ordem a9982623: botão "Fale com a Viva" arrastável e parado (sem pulo).
 * Clique abre; arrastar (> 6 px) move, NÃO abre e a posição persiste ao trocar de página.
 * 390 e 1280 px, na home e em /como-funciona (a página do imóvel usa a mesma lógica). E95: na /buscar o flutuante
 * não aparece, então a persistência é conferida noutra página.
 */
for (const largura of [390, 1280]) {
  test.describe(`T131 — Viva arrastável (${largura}px)`, () => {
    test.use({ viewport: { width: largura, height: 800 } });

    test("não anda sozinho ao rolar", async ({ page }) => {
      await page.goto("/", { waitUntil: "load" });
      const b = page.getByTestId("fale-com-a-viva");
      await expect(b).toBeVisible();
      const antes = await b.boundingBox();
      for (const y of [300, 900, 1800]) {
        await page.evaluate((yy) => window.scrollTo(0, yy), y);
        await page.waitForTimeout(250);
        expect(await b.boundingBox(), `rolou ${y}px`).toEqual(antes);
      }
    });

    test("clique abre; arraste move sem abrir e persiste", async ({ page }) => {
      await page.goto("/", { waitUntil: "load" });
      const b = page.getByTestId("fale-com-a-viva");
      await b.click();
      await expect(page.getByRole("dialog", { name: "Chat com a Viva" })).toBeVisible();
      await b.click();
      await expect(page.getByRole("dialog", { name: "Chat com a Viva" })).toHaveCount(0);

      const c = (await b.boundingBox())!;
      const x0 = c.x + c.width / 2;
      const y0 = c.y + c.height / 2;
      await page.mouse.move(x0, y0);
      await page.mouse.down();
      await page.mouse.move(40, y0 - 200, { steps: 8 });
      await page.mouse.up();
      await expect(page.getByRole("dialog", { name: "Chat com a Viva" })).toHaveCount(0);
      const raiz = page.getByTestId("fale-com-a-viva-raiz");
      await expect(raiz).toHaveAttribute("data-posicao", "esq");
      const depois = (await b.boundingBox())!;
      expect(depois.x).toBeLessThan(c.x);
      expect(depois.y).toBeLessThan(c.y - 100);

      await page.goto("/como-funciona", { waitUntil: "load" });
      await expect(page.getByTestId("fale-com-a-viva-raiz")).toHaveAttribute("data-posicao", "esq");
      const outra = (await page.getByTestId("fale-com-a-viva").boundingBox())!;
      expect(Math.abs(outra.x - depois.x)).toBeLessThan(2);
      expect(Math.abs(outra.y - depois.y)).toBeLessThan(2);
    });

    test("teclado: Enter abre o chat", async ({ page }) => {
      await page.goto("/", { waitUntil: "load" });
      await page.getByTestId("fale-com-a-viva").focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog", { name: "Chat com a Viva" })).toBeVisible();
    });
  });
}
