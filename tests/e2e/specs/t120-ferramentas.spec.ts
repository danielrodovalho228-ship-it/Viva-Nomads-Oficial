import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/*
  Central de Ferramentas (ampliação da ordem 9f3085d8): três grupos, quatro
  ferramentas reais em cada, foto do grupo carregada, cards da mesma altura em
  grade 2×2 (desktop) / 1 coluna (celular), e todo card com link abre uma tela
  real do painel (sem 404 e dentro da casca). Desktop 1440 e mobile 390.
*/
test.use({ storageState: authFile("proprietario") });

for (const largura of [1440, 390]) {
  test(`Ferramentas: 3 grupos × 4 cards uniformes com foto — ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura > 500 ? 900 : 844 });
    await page.goto("/dashboard/ferramentas", { waitUntil: "domcontentloaded" });
    const grupos = page.getByTestId("ferramentas-grupo");
    await expect(grupos).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      const g = grupos.nth(i);
      const foto = g.locator("img").first();
      await foto.scrollIntoViewIfNeeded();
      await expect
        .poll(() => foto.evaluate((im: HTMLImageElement) => im.complete && im.naturalWidth > 0), { timeout: 15_000 })
        .toBe(true);
      const cards = g.getByTestId("ferramenta-card");
      await expect(cards).toHaveCount(4);
      const alturas = await cards.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
      expect(Math.max(...alturas) - Math.min(...alturas), `grupo ${i}: alturas ${alturas}`).toBeLessThanOrEqual(1);
      const cols = await cards.first().evaluate((el) => getComputedStyle(el.parentElement!).gridTemplateColumns.split(" ").length);
      expect(cols).toBe(largura > 500 ? 2 : 1);
    }
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sobra).toBeLessThanOrEqual(1);
  });
}

test("Ferramentas: cada card com link abre uma tela do painel", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/dashboard/ferramentas", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("ferramenta-card")).toHaveCount(12, { timeout: 20_000 });
  const hrefs = await page.locator('a[data-testid="ferramenta-card"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
  expect(hrefs.length).toBe(11); // 12 ferramentas, 1 em estruturação (sem link)
  for (const href of hrefs) {
    // Âncora na mesma página (ex.: contratos → #conferencia) não gera resposta nova.
    const res = await page.goto(href, { waitUntil: "domcontentloaded" });
    if (res) expect(res.status(), href).toBeLessThan(400);
    expect(new URL(page.url()).pathname, href).toBe(href.split("#")[0]);
    await expect(page.locator("aside nav"), href).toBeVisible();
  }
});
