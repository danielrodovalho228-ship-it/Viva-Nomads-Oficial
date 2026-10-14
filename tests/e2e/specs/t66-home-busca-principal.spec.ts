import { test, expect } from "@playwright/test";

/**
 * T66 — ordem bab1b2aa (prints 01, 14, 15): home com hero em largura cheia,
 * UMA busca ("Para onde você vai?") e atalhos por categoria que abrem a /buscar
 * filtrada. Mobile-first: 360/390 px sem rolagem lateral; 1280 px com o hero
 * ocupando a largura toda.
 */
test.describe("T66 — Home: busca principal e atalhos", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const largura of [360, 390]) {
    test(`celular ${largura} px: uma busca, atalhos e sem rolagem lateral`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 844 });
      await page.goto("/", { waitUntil: "networkidle" });
      const busca = page.getByTestId("busca-principal");
      await expect(busca.getByLabel("Para onde você vai?")).toBeVisible();
      await expect(busca.locator("input")).toHaveCount(1);
      await expect(busca.locator("select")).toHaveCount(0);
      await expect(page.getByTestId("atalhos-categoria").getByRole("link")).toHaveCount(4);
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(sobra).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `tests/laboratorio/saida/t66-home-${largura}.png` });
    });
  }

  test("1280 px: hero em largura cheia e busca centralizada", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/", { waitUntil: "networkidle" });
    const hero = await page.getByTestId("hero-home").boundingBox();
    expect(hero?.x ?? 99).toBeLessThanOrEqual(1);
    expect(hero?.width ?? 0).toBeGreaterThanOrEqual(1270);
    const busca = await page.getByTestId("busca-principal").boundingBox();
    const centro = (busca?.x ?? 0) + (busca?.width ?? 0) / 2;
    expect(Math.abs(centro - 640)).toBeLessThan(40);
    await page.screenshot({ path: "tests/laboratorio/saida/t66-home-1280.png" });
  });

  test("buscar pela cidade leva à /buscar com o local", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.getByLabel("Para onde você vai?").fill("Uberlândia");
    await page.getByRole("button", { name: "Buscar imóveis" }).click();
    await expect(page).toHaveURL(/\/buscar\?local=Uberl%C3%A2ndia/);
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
