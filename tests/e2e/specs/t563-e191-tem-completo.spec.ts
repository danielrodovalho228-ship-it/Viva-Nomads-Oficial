import { test, expect } from "@playwright/test";

/*
  T563 — E191: no ube-006, a lista "Tem" do anúncio tem os mesmos itens do diálogo de comodidades ("Ver todas as N"),
  incluindo "Vaga de garagem" (antes: 6 no resumo × 7 no diálogo).
*/
const SAIDA = "tests/laboratorio/saida";

for (const largura of [390, 1280] as const) {
  test(`T563 — ${largura} px: 'Tem' = diálogo de comodidades (ube-006)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    await page.goto("/imoveis/ube-006", { waitUntil: "networkidle" });
    const tem = page.getByTestId("comodidades-tem");
    await tem.scrollIntoViewIfNeeded();
    await expect(tem.getByRole("heading", { name: "Tem" })).toBeVisible();
    const noResumo = (await tem.getByTestId("comodidade-item").allInnerTexts()).map((t) => t.trim()).sort();
    expect(noResumo).toContain("Vaga de garagem");
    await page.screenshot({ path: `${SAIDA}/t563-tem-${largura}.png` });
    const ver = page.getByTestId("comodidades-ver-todas");
    if (await ver.count()) {
      await ver.click();
      const lista = page.getByTestId("comodidades-lista-completa");
      await expect(lista).toBeVisible();
      const noDialogo = (await lista.getByTestId("comodidade-item").allInnerTexts()).map((t) => t.trim()).sort();
      expect(noResumo).toEqual(noDialogo);
      await expect(ver).toHaveText(`Ver todas as ${noDialogo.length} comodidades`);
    }
  });
}
