import { test, expect } from "@playwright/test";

/**
 * T161 — ordem dd15064d (coerência da página do imóvel), varrendo os 15 exemplos ube-001..015:
 *  título da aba = total do cartão; sem "1 quartos"/"1 banheiros"; "O que tem por perto" presente;
 *  legenda do calendário com "Ocupado (já reservado)" e "Bloqueado pelo proprietário" (E666); rótulo "Aceita pets". 390 e 1280 px.
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

// E666: a legenda diz as duas causas do dia fechado ("Ocupado (já reservado)" e "Bloqueado pelo proprietário"), não
// "Indisponível" sozinho. Rodada completa 5eb1fad9 (10/11).
test("calendário: legenda tem Ocupado e Bloqueado pelo proprietário", async ({ page }) => {
  await page.goto("/imoveis/ube-001", { waitUntil: "domcontentloaded" });
  const legenda = page.getByTestId("calendario-legenda");
  await expect(legenda).toBeVisible();
  await expect(legenda).toContainText("Ocupado (já reservado)");
  await expect(legenda).toContainText("Bloqueado pelo proprietário");
});
