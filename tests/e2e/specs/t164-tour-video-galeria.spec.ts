import { test, expect } from "@playwright/test";

/**
 * T164 — ordem 6f964617, tela 7: com vídeo, o tour vira a 1ª peça da galeria (sem autoplay com
 * som) e o cartão da /buscar ganha o selo "Tour em vídeo". Usa o anúncio de exemplo ube-001,
 * que tem vídeo. Só leitura: não grava nada.
 */
for (const [nome, largura, altura] of [
  ["390 px", 390, 844],
  ["1280 px", 1280, 800],
] as const) {
  test.describe(`T164 — tour em vídeo (${nome})`, () => {
    test.use({ viewport: { width: largura, height: altura } });

    test("o vídeo é a 1ª peça da galeria e abre sem autoplay", async ({ page }) => {
      await page.goto("/imoveis/ube-001");
      const peca = page.getByTestId("galeria-video").first();
      // No celular o carrossel e o mosaico coexistem no HTML; só um está visível por largura.
      const visivel = page.locator('[data-testid="galeria-video"]:visible').first();
      await expect(visivel).toBeVisible();
      await expect(visivel).toContainText("Tour em vídeo");
      expect(await peca.count()).toBeGreaterThan(0);

      await visivel.click();
      const janela = page.getByTestId("video-modal");
      await expect(janela).toBeVisible();
      const src = await janela.locator("iframe").getAttribute("src");
      expect(src).toMatch(/^https:\/\/www\.youtube\.com\/embed\//);
      expect(src).not.toMatch(/autoplay/);
      await page.keyboard.press("Escape");
      await expect(janela).toHaveCount(0);
    });

    test("a /buscar mostra o selo 'Tour em vídeo' no cartão do anúncio com vídeo", async ({ page }) => {
      await page.goto("/buscar");
      const cartao = page.locator('a[href="/imoveis/ube-001"]').first();
      await expect(cartao).toContainText("Tour em vídeo");
      // Respeita o limite: no máximo 2 selos sobre a foto.
      expect(await cartao.getByTestId("selos-foto").locator("> *").count()).toBeLessThanOrEqual(2);
    });
  });
}
