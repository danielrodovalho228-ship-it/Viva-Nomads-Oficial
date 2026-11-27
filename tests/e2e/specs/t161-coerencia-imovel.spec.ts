import { test, expect } from "@playwright/test";

/**
 * T161 — ordem dd15064d (coerência da página do imóvel), varrendo os 15 exemplos ube-001..015:
 *  título da aba = total do cartão; sem "1 quartos"/"1 banheiros"; "O que tem por perto" presente;
 *  legenda do calendário com os dois rótulos do E666 ("Ocupado (já reservado)" e "Bloqueado pelo proprietário", no lugar
 *  do antigo "Indisponível"); rótulo "Aceita pets". 390 e 1280 px.
 */
const IDS = Array.from({ length: 15 }, (_, i) => `ube-${String(i + 1).padStart(3, "0")}`);

for (const largura of [390, 1280]) {
  test(`${largura} px: os 15 exemplos são coerentes`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    for (const id of IDS) {
      await page.goto(`/imoveis/${id}`, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveTitle(/R\$\s[\d.]+\/mês total/);
      const corpo = page.locator("body");
      await expect(corpo).not.toContainText(/\b1 quartos\b|\b1 banheiros\b/);
      await expect(corpo).not.toContainText(/Aceita pet(?!s)/);
      await expect(page.getByRole("heading", { name: "Localização" })).toBeVisible();
      await expect(page.getByText("O que tem por perto")).toBeVisible();
    }
  });
}

// E744 (asserção alterada, tabela da Fable #3832): o E666 trocou "Indisponível" pelos dois rótulos da legenda.
test("calendário: a legenda tem os dois rótulos do E666 (ocupado e bloqueado)", async ({ page }) => {
  await page.goto("/imoveis/ube-001", { waitUntil: "domcontentloaded" });
  const legenda = page.getByTestId("calendario-legenda").first();
  await expect(legenda).toBeVisible();
  await expect(legenda).toContainText("Ocupado (já reservado)");
  await expect(legenda).toContainText("Bloqueado pelo proprietário");
});
