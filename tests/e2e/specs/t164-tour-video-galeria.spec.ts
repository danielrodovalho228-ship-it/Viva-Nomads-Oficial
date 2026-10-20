import { test, expect } from "@playwright/test";

/**
 * T164 — ordem 6f964617 (tela 7) + 20beb2c6: o tour em vídeo só aparece com vídeo REAL e válido
 * (id do YouTube de 11 caracteres ou Vimeo numérico). O anúncio de exemplo ube-001 NÃO tem vídeo
 * (o antigo apontava para um id inexistente): sem selo, sem peça de vídeo, sem iframe, e o mosaico
 * volta às fotos. A validação do id (válido mostra, inválido não mostra nada) é provada no
 * unitário src/lib/video-tour.test.ts. Só leitura: não grava nada.
 */
for (const [nome, largura, altura] of [
  ["390 px", 390, 844],
  ["1280 px", 1280, 800],
] as const) {
  test.describe(`T164 — sem tour em vídeo inventado (${nome})`, () => {
    test.use({ viewport: { width: largura, height: altura } });

    test("ube-001 não tem peça de vídeo nem iframe na página", async ({ page }) => {
      await page.goto("/imoveis/ube-001");
      await expect(page.locator("h1").first()).toBeVisible();
      await expect(page.getByTestId("galeria-video")).toHaveCount(0);
      await expect(page.getByTestId("video-modal")).toHaveCount(0);
      await expect(page.locator('iframe[src*="youtube"], iframe[src*="vimeo"]')).toHaveCount(0);
      await expect(page.getByText("Tour em vídeo")).toHaveCount(0);
    });

    test("a /buscar não mostra o selo 'Tour em vídeo' no cartão do ube-001", async ({ page }) => {
      await page.goto("/buscar?exemplos=1");
      const cartao = page.locator('a[href="/imoveis/ube-001"]').first();
      await expect(cartao).toBeVisible();
      await expect(cartao).not.toContainText("Tour em vídeo");
    });
  });
}
