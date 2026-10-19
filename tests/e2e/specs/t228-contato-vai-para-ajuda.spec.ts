import { test, expect } from "@playwright/test";

/**
 * T228 — ordem 7436a29a, item 2 (F25): /contato não existe como página; o canal único é a Central de Ajuda.
 * Redirecionamento permanente (308), sem página nova, e a Central abre sem rolagem lateral no celular.
 */
test("/contato responde 308 para /ajuda", async ({ request }) => {
  const r = await request.get("/contato", { maxRedirects: 0 });
  expect(r.status()).toBe(308);
  expect(new URL(r.headers()["location"] ?? "", "http://x").pathname).toBe("/ajuda");
});

for (const largura of [390, 1280]) {
  test(`${largura} px: quem abre /contato chega na Central de Ajuda, sem rolagem lateral`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 844 });
    await page.goto("/contato", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/ajuda\/?$/);
    const sem = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    expect(sem).toBe(true);
  });
}
