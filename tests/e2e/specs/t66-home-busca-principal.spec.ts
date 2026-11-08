import { test, expect } from "@playwright/test";

/**
 * T66 — home: topo do mockup `publico-home` (E712: título, "Buscar moradia" e "Publicar pedido de moradia", foto) e
 * atalhos por categoria que abrem a /buscar filtrada. A busca de um campo ("Para onde você vai?") saiu do topo,
 * que no mockup não a tem: "Buscar moradia" leva à /buscar. Mobile-first: 360/390 px sem rolagem lateral.
 */
test.describe("T66 — Home: busca principal e atalhos", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const largura of [360, 390]) {
    test(`celular ${largura} px: uma busca, atalhos e sem rolagem lateral`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 844 });
      await page.goto("/", { waitUntil: "networkidle" });
      await expect(page.getByTestId("hero-titulo")).toBeVisible();
      await expect(page.getByTestId("home-buscar-moradia")).toBeVisible();
      await expect(page.getByTestId("home-publicar-pedido")).toBeVisible();
      await expect(page.getByTestId("atalhos-categoria").getByRole("link")).not.toHaveCount(0); // 5 atalhos; some o que tiver 0 imóveis (ordem a875278a)
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(sobra).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `tests/laboratorio/saida/t66-home-${largura}.png` });
    });
  }

  test("1280 px: título à esquerda e foto à direita, lado a lado", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/", { waitUntil: "networkidle" });
    const titulo = await page.getByTestId("hero-titulo").boundingBox();
    const foto = await page.getByTestId("hero-foto").boundingBox();
    expect(titulo && foto && titulo.x + titulo.width <= foto.x + 1).toBe(true);
    await expect(page.getByTestId("hero-foto")).toHaveJSProperty("complete", true);
    await page.screenshot({ path: "tests/laboratorio/saida/t66-home-1280.png" });
  });

  test("'Buscar moradia' leva à /buscar", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.getByTestId("home-buscar-moradia").click();
    await expect(page).toHaveURL(/\/buscar/);
  });

  test("atalhos abrem a /buscar já filtrada", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.getByTestId("atalhos-categoria").getByRole("link", { name: /Aceita pets/ }).click();
    await expect(page).toHaveURL(/\/buscar\?(.*&)?pet=1/);
    await page.goto("/", { waitUntil: "networkidle" });
    await page.getByTestId("atalhos-categoria").getByRole("link", { name: /3\+ quartos/ }).click();
    await expect(page).toHaveURL(/\/buscar\?(.*&)?quartos=3/);
  });
});
