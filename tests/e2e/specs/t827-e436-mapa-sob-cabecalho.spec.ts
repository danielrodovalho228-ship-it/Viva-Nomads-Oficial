import { test, expect } from "@playwright/test";

/*
  T827 — E436 (D-V11): com o mapa do anúncio rolado para baixo do cabeçalho fixo, quem fica por cima na faixa do
  cabeçalho é o CABEÇALHO (antes o aviso do E419 passava por cima). O aviso segue visível no quadro. 1280 e 390.
*/
for (const largura of [1280, 390] as const) {
  test(`T827 — mapa por baixo do cabeçalho (${largura} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const r = await page.goto("/imoveis/ube-001", { waitUntil: "domcontentloaded" });
    test.skip(!r || r.status() === 404, "Sem o anúncio de exemplo ube-001 neste ambiente.");
    const quadro = page.getByTestId("mapa-quadro").first();
    await expect(quadro).toBeAttached({ timeout: 30_000 });
    const noTopo = await quadro.evaluate((q) => {
      document.documentElement.style.scrollBehavior = "auto";
      q.scrollIntoView({ block: "start", behavior: "instant" });
      const b = q.getBoundingClientRect();
      const el = document.elementFromPoint(Math.round(b.left + b.width / 2), 20);
      return el?.closest("header") ? "cabecalho" : el?.closest('[data-testid="mapa-quadro"]') ? "mapa" : el?.tagName ?? "nada";
    });
    expect(noTopo).toBe("cabecalho");
    if (await page.getByTestId("mapa-indisponivel").count()) {
      await quadro.scrollIntoViewIfNeeded();
      await expect(page.getByTestId("mapa-indisponivel").first()).toBeVisible();
    }
  });
}
