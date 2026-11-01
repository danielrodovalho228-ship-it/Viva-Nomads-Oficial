import { test, expect, type Locator, type Page } from "@playwright/test";

/**
 * T952 — E408 (#2062): o lightbox da galeria fecha ao clicar no fundo escuro (fora da foto e dos botões), como os
 * outros diálogos do site — e é um diálogo de verdade (role=dialog, aria-modal, nome "Fotos de <título>"). Pela tela
 * real, no anúncio de exemplo com várias fotos, 390 (toque) e 1280:
 *   1. o lightbox abre como diálogo modal com o nome das fotos;
 *   2. clicar NA foto, no contador e em "Próxima foto" NÃO fecha (o contador anda só com o botão);
 *   3. clicar no fundo escuro (a margem em volta da foto) fecha, e a página volta sem o diálogo.
 */
const IMOVEL = "/imoveis/ube-001";

async function abrir(page: Page): Promise<Locator> {
  const contador = page.getByTestId("galeria-contador");
  await expect(async () => {
    await page.getByTestId("galeria-tile-0").locator("visible=true").first().click();
    await expect(contador).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 40_000 });
  return contador;
}

for (const largura of [390, 1280] as const) {
  test.describe(`T952 — E408: o lightbox fecha no fundo, não na foto (${largura} px)`, () => {
    test.use(largura === 390 ? { viewport: { width: 390, height: 844 }, hasTouch: true } : { viewport: { width: 1280, height: 900 } });

    test(`diálogo modal; foto, contador e "Próxima" não fecham; o fundo fecha (${largura})`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.goto(IMOVEL, { waitUntil: "domcontentloaded" });
      const contador = await abrir(page);
      const caixa = page.getByTestId("galeria-lightbox");
      await expect(caixa).toHaveAttribute("role", "dialog");
      await expect(caixa).toHaveAttribute("aria-modal", "true");
      await expect(caixa).toHaveAttribute("aria-label", /^Fotos de .+/);
      await expect(contador).toHaveText(/^1 \/ \d+$/);

      // Na foto: não fecha.
      const foto = caixa.locator("img").first();
      await expect(foto).toBeVisible();
      await foto.click();
      await expect(caixa).toBeVisible();
      await expect(contador).toHaveText(/^1 \/ \d+$/);
      // No contador: não fecha.
      await contador.click();
      await expect(caixa).toBeVisible();
      // "Próxima foto": anda, não fecha.
      await caixa.getByRole("button", { name: "Próxima foto" }).click();
      await expect(contador).toHaveText(/^2 \/ \d+$/);
      await expect(caixa).toBeVisible();

      // O fundo escuro (a margem de baixo, fora da foto): fecha.
      const fundo = page.getByTestId("galeria-lightbox-fundo");
      const b = (await fundo.boundingBox())!;
      await fundo.click({ position: { x: 6, y: b.height - 6 } });
      await expect(caixa).toHaveCount(0, { timeout: 10_000 });
      await expect(page.getByRole("dialog", { name: /^Fotos de / })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    });
  });
}
