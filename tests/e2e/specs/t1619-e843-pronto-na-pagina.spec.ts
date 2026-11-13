import { test, expect } from "@playwright/test";

/*
  T1619 — E843 (Phoenix RELATORIO-016, A-03/A-29): o filtro "Pronto para Morar" conta todo exemplo com o selo, e a página de
  CADA um diz "Pronto para morar" nos destaques (antes o corte em 3 destaques o tirava em 6 dos 15). Página pública, 1280 e 390.
*/
const IDS = Array.from({ length: 15 }, (_, i) => `ube-${String(i + 1).padStart(3, "0")}`);

for (const [largura, altura] of [[1280, 900], [390, 844]] as const) {
  test(`a ${largura} px: os 15 exemplos com o selo dizem "Pronto para morar" nos destaques`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: altura });
    const faltam: string[] = [];
    for (const id of IDS) {
      await page.goto(`/imoveis/${id}`, { waitUntil: "domcontentloaded" });
      const destaques = page.getByTestId("destaques-imovel");
      await expect(destaques, `${id}: bloco de destaques`).toBeVisible({ timeout: 30_000 });
      if (!(await destaques.getByText("Pronto para morar", { exact: true }).count())) faltam.push(id);
    }
    expect(faltam, `páginas sem "Pronto para morar" nos destaques: ${faltam.join(", ")}`).toEqual([]);
  });
}
