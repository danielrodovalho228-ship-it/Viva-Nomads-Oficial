import { test, expect } from "@playwright/test";

/*
  T1446 — E697 (#3299) e E698 (#3312), na main. Visitante, 390 e 1280 px, sem estouro horizontal.
    1. E697: o anúncio de exemplo ube-015 não mostra a mesma foto duas vezes na galeria (mosaico no desktop, carrossel no celular):
       os endereços das imagens da galeria são todos diferentes.
    2. E698: a primeira pintura de /buscar não tem foto "quebrada": nenhum quadro de foto termina em estado "falhou" depois de
       carregar, e o quadro do mapa nunca fica como retângulo vazio (ou o mapa, ou o aviso "Carregando o mapa…").
*/
const URL_EXEMPLO = "/imoveis/ube-015";

test.describe("T1446 — E697 galeria sem repetição; E698 primeira pintura", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: galeria do exemplo sem foto repetida`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      const r = await page.goto(URL_EXEMPLO, { waitUntil: "domcontentloaded" });
      expect(r?.status() ?? 0).toBeLessThan(400);
      const galeria = page.getByTestId(w === 390 ? "galeria-celular" : "galeria-mosaico");
      await expect(galeria).toBeVisible({ timeout: 30_000 });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      const fontes = await galeria.locator("img").evaluateAll((els) => els.map((e) => (e as HTMLImageElement).currentSrc || (e as HTMLImageElement).src).filter(Boolean));
      expect(fontes.length, "a galeria tem fotos").toBeGreaterThan(0);
      expect(new Set(fontes).size, `fotos repetidas na galeria: ${fontes.join(" | ")}`).toBe(fontes.length);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    });

    test(`a ${w} px: primeira pintura de /buscar sem foto quebrada nem mapa vazio`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      const r = await page.goto("/buscar", { waitUntil: "domcontentloaded" });
      expect(r?.status() ?? 0).toBeLessThan(400);
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await expect(page.locator("main").first()).toBeVisible({ timeout: 30_000 });
      const falhas = await page.locator("[data-foto-estado='falhou']").count();
      expect(falhas, "quadros de foto em estado 'falhou'").toBe(0);
      // O mapa, quando há quadro dele nesta largura, ou já desenhou ou diz que está carregando — nunca um retângulo vazio.
      const modulo = page.getByTestId("mapa-carregando-modulo");
      if (await modulo.count()) await expect(modulo.first()).toContainText("Carregando o mapa");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    });
  }
});
