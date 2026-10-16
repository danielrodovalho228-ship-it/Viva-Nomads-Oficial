import { test, expect } from "@playwright/test";

/**
 * Ordem 7ffea8c7 — a barra "Comparar" não pode ficar atrás da barra de abas do celular
 * nem colidir com o "Fale com a Viva". 390x844, público.
 */
test.describe("T150 — Barra Comparar acima das abas (390 px)", () => {
  test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 390, height: 844 } });

  test("marcar 1 e 2 imóveis: barra acima da nav, sem tocar no Fale com a Viva; último cartão acima da nav", async ({ page }) => {
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    const marcas = page.getByTestId("marcar-comparar");
    await expect(marcas.first()).toBeVisible();
    test.skip((await marcas.count()) < 2, "menos de 2 imóveis na busca do ambiente");

    const nav = page.getByRole("navigation", { name: "Navegação principal" });
    const conferir = async () => {
      const barra = await page.getByTestId("barra-comparar").locator("> div").boundingBox();
      const navBox = await nav.boundingBox();
      expect(barra).not.toBeNull();
      expect(navBox).not.toBeNull();
      expect(barra!.y + barra!.height).toBeLessThanOrEqual(navBox!.y - 8);
      const viva = page.getByTestId("fale-com-a-viva-raiz");
      if (await viva.isVisible()) {
        const v = await viva.boundingBox();
        const sobrepoe = v!.y < barra!.y + barra!.height && v!.y + v!.height > barra!.y && v!.x < barra!.x + barra!.width && v!.x + v!.width > barra!.x;
        expect(sobrepoe).toBe(false);
      }
    };

    await marcas.nth(0).check();
    await conferir();
    await marcas.nth(1).check();
    await conferir();
    await expect(page.getByTestId("comparar-abrir")).toContainText("Comparar (2)");
    await page.getByTestId("comparar-abrir").click({ trial: true });

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const ultimo = await page.getByTestId("marcar-comparar").last().evaluate((el) => el.closest("label")?.parentElement?.getBoundingClientRect().bottom ?? 0);
    const navTop = (await nav.boundingBox())!.y;
    expect(ultimo).toBeLessThanOrEqual(navTop);
  });
});
