import { test, expect } from "@playwright/test";

/**
 * Ordem 7ffea8c7 — a barra "Comparar" não pode ficar atrás da barra de abas do celular
 * nem colidir com o "Fale com a Viva". 390x844, público.
 */
// Chave da posição salva do "Fale com a Viva" (flutuante-arrastavel.ts).
const CHAVE = "vivanomads-viva-posicao";

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

    // Cartão por cartão (até o limite da comparação): a barra segue acima da nav e sem tocar no Fale com a Viva.
    const total = Math.min(await marcas.count(), 4);
    for (let i = 0; i < total; i++) {
      await marcas.nth(i).check();
      await conferir();
    }
    await expect(page.getByTestId("comparar-abrir")).toContainText(`Comparar (${total})`);
    await page.getByTestId("comparar-abrir").click({ trial: true });

    // A lista da busca carrega aos poucos: rola até o fim de novo a cada tentativa, até o último cartão assentar.
    const navTop = (await nav.boundingBox())!.y;
    await expect
      .poll(
        async () => {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          return page.getByTestId("marcar-comparar").last().evaluate((el) => el.closest("label")?.parentElement?.getBoundingClientRect().bottom ?? 0);
        },
        { message: "o último cartão fica acima da nav", timeout: 15_000, intervals: [500] },
      )
      .toBeLessThanOrEqual(navTop);
  });

  test("Fale com a Viva já arrastado para baixo não cobre a barra Comparar (ordem af3a27e3)", async ({ page }) => {
    await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [CHAVE, JSON.stringify({ lado: "dir", baixo: 20 })]);
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    const marcas = page.getByTestId("marcar-comparar");
    await expect(marcas.first()).toBeVisible();
    test.skip((await marcas.count()) < 1, "sem imóveis na busca do ambiente");
    await marcas.nth(0).check();
    const barra = (await page.getByTestId("barra-comparar").locator("> div").boundingBox())!;
    const viva = page.getByTestId("fale-com-a-viva-raiz");
    if (await viva.isVisible()) {
      const v = (await viva.boundingBox())!;
      expect(v.y + v.height).toBeLessThanOrEqual(barra.y);
    }
  });
});

test.describe("T150 — home e computador (ordem af3a27e3)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("home 390 px: o Fale com a Viva fica acima da barra de abas", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const viva = page.getByTestId("fale-com-a-viva-raiz");
    test.skip(!(await viva.isVisible()), "Fale com a Viva oculto na home do ambiente");
    const v = (await viva.boundingBox())!;
    const n = (await page.getByRole("navigation", { name: "Navegação principal" }).boundingBox())!;
    expect(v.y + v.height).toBeLessThanOrEqual(n.y);
  });

  test("1280 px: barra Comparar a 12 px do rodapé (bottom-3) e sem tocar no Fale com a Viva", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    const marcas = page.getByTestId("marcar-comparar");
    await expect(marcas.first()).toBeVisible();
    test.skip((await marcas.count()) < 1, "sem imóveis na busca do ambiente");
    await marcas.nth(0).check();
    const barra = (await page.getByTestId("barra-comparar").locator("> div").boundingBox())!;
    const folga = 800 - (barra.y + barra.height);
    expect(folga).toBeGreaterThanOrEqual(11);
    expect(folga).toBeLessThanOrEqual(13);
    const viva = page.getByTestId("fale-com-a-viva-raiz");
    if (await viva.isVisible()) {
      const v = (await viva.boundingBox())!;
      const sobrepoe = v.y < barra.y + barra.height && v.y + v.height > barra.y && v.x < barra.x + barra.width && v.x + v.width > barra.x;
      expect(sobrepoe).toBe(false);
    }
  });
});
