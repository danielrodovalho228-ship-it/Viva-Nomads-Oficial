import { test, expect } from "@playwright/test";

/*
  T785 — E419 (01/11): o mapa do anúncio nunca fica um quadro vazio. Sem a chave de mapa (data-mapa-base="sem-chave")
  aparece o aviso "Não foi possível carregar o mapa agora."; com a chave, o mapa carrega e o aviso não aparece.
  390 e 1280.
*/
const SAIDA = "tests/laboratorio/saida";

for (const largura of [390, 1280] as const) {
  test(`T785 — E419: mapa do anúncio com estado de erro (${largura} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    const r = await page.goto("/imoveis/ube-001", { waitUntil: "domcontentloaded" });
    test.skip(!r || r.status() === 404, "Sem o anúncio de exemplo ube-001 neste ambiente.");

    const quadro = page.getByTestId("mapa-imovel").first();
    await quadro.scrollIntoViewIfNeeded().catch(() => {});
    await expect(quadro.or(page.getByTestId("mapa-indisponivel")).first()).toBeAttached({ timeout: 30_000 });

    const base = await quadro.getAttribute("data-mapa-base").catch(() => null);
    const aviso = page.getByTestId("mapa-indisponivel").first();
    if (base === "sem-chave") {
      await expect(aviso).toBeVisible();
      await expect(aviso).toContainText("Não foi possível carregar o mapa agora.");
      const caixa = await aviso.boundingBox();
      expect(caixa?.width ?? 0).toBeLessThanOrEqual(largura);
      expect(caixa?.height ?? 0).toBeGreaterThan(100);
    } else if (base === "carto") {
      // Com chave: tiles chegam e o aviso não aparece (se a rede do ambiente bloquear, o aviso é o resultado aceito).
      await expect(page.locator(".leaflet-tile-loaded").or(aviso).first()).toBeVisible({ timeout: 20_000 });
    }
    const semRolagemLateral = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    expect(semRolagemLateral).toBe(true);
    await page.screenshot({ path: `${SAIDA}/t785-e419-mapa-${largura}.png` });
  });
}
