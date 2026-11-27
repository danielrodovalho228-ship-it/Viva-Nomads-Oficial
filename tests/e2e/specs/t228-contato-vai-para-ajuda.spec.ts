import { test, expect } from "@playwright/test";

/**
 * T228 — E851 (antes ordem 7436a29a, item 2 / F25): /contato não existe como página; o canal é o "Fale com a Viva" da
 * Central de Ajuda. Redirecionamento permanente (308), sem página nova, e a tela abre sem rolagem lateral no celular.
 * E744 (asserção alterada, tabela da Fable #3832): o destino passou de /ajuda para /ajuda/fale-com-a-viva no E851.
 */
test("/contato responde 308 para /ajuda/fale-com-a-viva", async ({ request }) => {
  const r = await request.get("/contato", { maxRedirects: 0 });
  expect(r.status()).toBe(308);
  expect(new URL(r.headers()["location"] ?? "", "http://x").pathname).toBe("/ajuda/fale-com-a-viva");
});

for (const largura of [390, 1280]) {
  test(`${largura} px: quem abre /contato chega no Fale com a Viva da Central de Ajuda, sem rolagem lateral`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 844 });
    await page.goto("/contato", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/ajuda\/fale-com-a-viva\/?$/);
    const sem = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    expect(sem).toBe(true);
  });
}
