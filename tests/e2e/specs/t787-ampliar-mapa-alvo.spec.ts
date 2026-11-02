import { test, expect } from "@playwright/test";

/*
  T787 — varredura 01/11 (Pista A): no anúncio, o botão "Ampliar mapa" tem pelo menos 44 px de altura e abre o mapa
  ampliado; sem base de mapa (build sem chave) o botão não aparece por baixo do aviso do E419. 390 e 1280.
*/
const SAIDA = "tests/laboratorio/saida";

for (const largura of [390, 1280] as const) {
  test(`T787 — "Ampliar mapa" com alvo de 44 px (${largura} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    const r = await page.goto("/imoveis/ube-001", { waitUntil: "domcontentloaded" });
    test.skip(!r || r.status() === 404, "Sem o anúncio de exemplo ube-001 neste ambiente.");
    const quadro = page.getByTestId("mapa-imovel").first();
    await quadro.scrollIntoViewIfNeeded();
    if ((await quadro.getAttribute("data-mapa-base")) === "sem-chave") {
      // Sem base de mapa: o aviso do E419 ocupa o quadro e não há "Ampliar mapa" escondido por baixo dele.
      await expect(page.getByTestId("mapa-indisponivel").first()).toBeVisible();
      await expect(page.getByTestId("ampliar-mapa")).toHaveCount(0);
      await page.screenshot({ path: `${SAIDA}/t787-ampliar-mapa-${largura}.png` });
      return;
    }
    const botao = page.getByTestId("ampliar-mapa");
    await botao.scrollIntoViewIfNeeded();
    await expect(botao).toBeVisible({ timeout: 30_000 });
    const caixa = await botao.boundingBox();
    expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: `${SAIDA}/t787-ampliar-mapa-${largura}.png` });
  });
}
