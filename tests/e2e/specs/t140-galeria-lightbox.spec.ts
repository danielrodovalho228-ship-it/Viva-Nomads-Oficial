import { test, expect, type Locator, type Page } from "@playwright/test";

/**
 * T140 — Galeria: toda foto abre o lightbox na própria posição (ordem d1b76e6b, P0 16/10).
 * ube-001 tem várias fotos: mosaico mostra 5 e o "+N mais" abre na 6ª.
 */
const IMOVEL = "/imoveis/ube-001";
// O anúncio de exemplo cresceu (8 → 20 fotos): o spec confere a POSIÇÃO e que há ao menos 8,
// sem fixar o total (ordem 75553f0a: specs desatualizadas).
const posicao = (n: number) => new RegExp(`^${n} / (\\d{1,3})$`);

// Sem esperar a rede aquietar (estourava os 45 s no lab): o clique é refeito até a página hidratar e o lightbox abrir.
async function abrir(page: Page, id: string, contador: Locator) {
  await expect(async () => {
    await page.getByTestId(id).locator("visible=true").first().click();
    await expect(contador).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}

for (const largura of [1280, 1920]) {
  test.describe(`${largura} px`, () => {
    test.use({ viewport: { width: largura, height: 1100 } });

    test("nenhuma camada cobre o centro de cada tile", async ({ page }) => {
      await page.goto(IMOVEL, { waitUntil: "domcontentloaded" });
      for (let i = 0; i < 5; i++) {
        const tile = page.getByTestId(`galeria-tile-${i}`).locator("visible=true").first();
        const c = (await tile.boundingBox())!;
        const noTopo = await page.evaluate(
          ({ x, y, i }) => {
            const el = document.elementFromPoint(x, y);
            // ordem a45eec8b: o "+N mais" é botão de canto; o centro de cada miniatura (inclusive a 5ª) é a própria foto
            return !!el?.closest(`[data-testid="galeria-tile-${i}"]`);
          },
          { x: c.x + c.width / 2, y: c.y + c.height / 2, i },
        );
        expect(noTopo, `tile ${i} coberto`).toBe(true);
      }
    });

    const casos: [string, number][] = [
      ["galeria-tile-0", 1],
      ["galeria-tile-1", 2],
      ["galeria-tile-2", 3],
      ["galeria-tile-3", 4],
      ["galeria-tile-4", 5],
      ["galeria-mais", 6],
      ["galeria-ver-todas", 1],
    ];
    for (const [id, esperado] of casos) {
      test(`${id} abre em ${esperado}, navega e fecha`, async ({ page }) => {
        await page.goto(IMOVEL, { waitUntil: "domcontentloaded" });
        const contador = page.getByTestId("galeria-contador");
        await abrir(page, id, contador);
        await expect(contador).toHaveText(posicao(esperado));
        await page.keyboard.press("ArrowRight");
        await expect(contador).toHaveText(posicao(esperado + 1));
        await page.keyboard.press("ArrowLeft");
        await expect(contador).toHaveText(posicao(esperado));
        await page.keyboard.press("Escape");
        await expect(page.getByTestId("galeria-lightbox")).toHaveCount(0);
      });
    }
  });
}

test.describe("390 px", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("tocar na foto atual abre nela; botões e fechar funcionam", async ({ page }) => {
    await page.goto(IMOVEL, { waitUntil: "domcontentloaded" });
    const contador = page.getByTestId("galeria-contador");
    await abrir(page, "galeria-tile-0", contador);
    await expect(contador).toHaveText(posicao(1));
    await page.getByRole("button", { name: "Próxima foto" }).click();
    await expect(contador).toHaveText(posicao(2));
    await page.getByRole("button", { name: "Foto anterior" }).click();
    await expect(contador).toHaveText(posicao(1));
    await page.getByRole("button", { name: "Fechar" }).click();
    await expect(page.getByTestId("galeria-lightbox")).toHaveCount(0);
  });
});
