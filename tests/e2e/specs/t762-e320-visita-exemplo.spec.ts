import { test, expect } from "@playwright/test";

/*
  T762 — E320 → E694 (resíduo): no anúncio de EXEMPLO a visita (por vídeo ou presencial) não tem botão ativo — a coluna
  explica e leva aos imóveis reais (/buscar). Antes (E320), o botão abria uma folha com a explicação; hoje a explicação
  já está à vista, sem esforço. A 390 e a 1280.
*/
for (const largura of [390, 1280] as const) {
  test(`T762 — E320/E694: o exemplo explica e dá saída, sem botão de visita (${largura} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    const r = await page.goto("/imoveis/ube-001", { waitUntil: "domcontentloaded" });
    test.skip(!r || r.status() === 404, "Sem o anúncio de exemplo ube-001 neste ambiente.");

    await expect(page.getByTestId("visita-video-abrir")).toHaveCount(0);
    await expect(page.getByTestId("agendar-visita")).toHaveCount(0);
    await expect(page.getByTestId("barra-agendar-visita")).toHaveCount(0);
    const explicacao = page.getByTestId("exemplo-sem-acoes");
    await expect(explicacao).toContainText("visita por vídeo");
    const saida = largura >= 1024 ? explicacao.getByTestId("exemplo-ver-reais") : page.getByTestId("barra-ver-reais");
    await expect(saida).toHaveAttribute("href", "/buscar");
    await saida.click();
    await expect(page).toHaveURL(/\/buscar/, { timeout: 30_000 });
  });
}
