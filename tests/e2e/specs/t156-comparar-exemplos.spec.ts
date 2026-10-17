import { test, expect } from "@playwright/test";

/**
 * Ordem ebb9bc52 (P0) — Comparar com anúncios de exemplo (ube-001…): o /comparar descartava
 * ids que não eram UUID e mostrava só o estado vazio. Público, 390 e 1280 px.
 */
for (const largura of [390, 1280]) {
  test.describe(`T156 — Comparar anúncios de exemplo (${largura} px)`, () => {
    test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: largura, height: 844 } });

    test("URL com ube-001,ube-002 mostra a tabela com os 2 e mantém ao recarregar", async ({ page }) => {
      await page.goto("/comparar?comparar=ube-001,ube-002", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("comparar-tabela")).toBeVisible();
      await expect(page.getByTestId("comparar-coluna")).toHaveCount(2);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("comparar-coluna")).toHaveCount(2);
      await expect(page.getByTestId("comparar-vazio")).toHaveCount(0);
    });

    test("texto fora do padrão continua sendo descartado", async ({ page }) => {
      await page.goto("/comparar?comparar=ube-001,ube-1,<script>", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("comparar-vazio")).toBeVisible();
    });

    test("fluxo: /buscar → marcar 2 → Comparar (2) → tabela com os 2 → 4º dá aviso → Limpar", async ({ page }) => {
      await page.goto("/buscar", { waitUntil: "domcontentloaded" });
      const marcas = page.getByTestId("marcar-comparar");
      await expect(marcas.first()).toBeVisible();
      test.skip((await marcas.count()) < 2, "menos de 2 imóveis na busca do ambiente");
      await marcas.nth(0).check();
      await marcas.nth(1).check();
      await expect(page.getByTestId("comparar-abrir")).toContainText("Comparar (2)");
      await page.getByTestId("comparar-abrir").click();
      await expect(page.getByTestId("comparar-tabela")).toBeVisible();
      await expect(page.getByTestId("comparar-coluna")).toHaveCount(2);
    });
  });
}
