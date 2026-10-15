import { test, expect } from "@playwright/test";

/**
 * T105 — Central de Guias (ordem 1438f18d, Próximo do FF 6/6): /guias lista 6 guias,
 * cada um tem JSON-LD Article no HTML sem JavaScript, links para /buscar e
 * /para-proprietarios, e todos estão no sitemap. Sem rolagem lateral a 390 px.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "chromium", "só no projeto do site (chromium)");
});

test("/guias lista os 6 guias, sem rolagem lateral a 390 px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/guias");
  await expect(page.getByRole("heading", { level: 1, name: "Guias" })).toBeVisible();
  await expect(page.locator('a[href^="/guias/"]')).toHaveCount(6);
  const largura = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(largura).toBeLessThanOrEqual(1);
});

test("guia: título, links internos e JSON-LD Article sem JavaScript", async ({ request, page }) => {
  const res = await request.get("/guias/o-que-e-a-caucao");
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).toMatch(/"@type":"Article"/);
  expect(html).not.toMatch(/latitude|longitude/i);
  await page.goto("/guias/o-que-e-a-caucao");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Caução");
  await expect(page.getByRole("link", { name: /Buscar imóveis mobiliados/ })).toHaveAttribute("href", "/buscar");
  await expect(page.getByRole("link", { name: /Anunciar o meu imóvel/ })).toHaveAttribute("href", "/para-proprietarios");
});

test("guia inexistente dá 404 e o sitemap traz os 6 guias", async ({ request }) => {
  expect((await request.get("/guias/nao-existe")).status()).toBe(404);
  const xml = await (await request.get("/sitemap.xml")).text();
  expect((xml.match(/\/guias\/[a-z-]+</g) ?? []).length).toBe(6);
  expect(xml).toMatch(/\/guias</);
});
