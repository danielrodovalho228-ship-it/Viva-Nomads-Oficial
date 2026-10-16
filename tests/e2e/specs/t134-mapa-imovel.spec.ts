import { test, expect } from "@playwright/test";

/**
 * T131 — Mapa da página do imóvel igual ao da /buscar (ordem b4fd5b18): mapa real
 * (Leaflet + CARTO sem token Mapbox), com tiles, e "Ampliar mapa" abrindo a tela cheia,
 * a 390 e 1280 px. Nunca o ponto exato do imóvel.
 */
for (const largura of [390, 1280]) {
  test(`T131 — /imoveis/ube-001 mostra o mapa real e o "Ampliar mapa" abre a ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
    const mapa = page.getByTestId("mapa-imovel").first();
    await mapa.scrollIntoViewIfNeeded();
    await expect(mapa).toBeVisible();
    // Leaflet montou (não é o placeholder antigo)
    await expect(page.locator(".leaflet-container").first()).toBeVisible();
    // área aproximada desenhada
    await expect(page.locator(".leaflet-container path").first()).toBeAttached();
    // com a chave da CARTO no build: atribuição OpenStreetMap/CARTO e tiles carregados
    // (sem chave nenhum tile é pedido — nunca o carimbo "API KEY REQUIRED")
    if ((await mapa.getAttribute("data-mapa-base")) === "carto") {
      await expect(page.locator(".leaflet-control-attribution").first()).toContainText("CARTO");
      await expect(page.locator(".leaflet-tile-loaded").first()).toBeAttached({ timeout: 15000 });
    }
    await page.getByTestId("ampliar-mapa").click();
    const cheio = page.getByTestId("mapa-tela-cheia");
    await expect(cheio).toBeVisible();
    await expect(cheio.locator(".leaflet-container")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(cheio).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });
}
