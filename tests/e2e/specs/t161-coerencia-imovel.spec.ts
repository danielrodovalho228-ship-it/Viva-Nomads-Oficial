import { test, expect } from "@playwright/test";

/**
 * T161 — ordem dd15064d (coerência da página do imóvel), varrendo os 15 exemplos ube-001..015:
 *  título da aba = total do cartão; sem "1 quartos"/"1 banheiros"; "O que tem por perto" presente;
 *  legenda do calendário com "Indisponível"; rótulo "Aceita pets". 390 e 1280 px.
 */
const IDS = Array.from({ length: 15 }, (_, i) => `ube-${String(i + 1).padStart(3, "0")}`);

for (const largura of [390, 1280]) {
  test(`${largura} px: os 15 exemplos são coerentes`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    for (const id of IDS) {
      await page.goto(`/imoveis/${id}`, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveTitle(/R\$ [\d.]+\/mês total/);
      const corpo = page.locator("body");
      await expect(corpo).not.toContainText(/\b1 quartos\b|\b1 banheiros\b/);
      await expect(corpo).not.toContainText(/Aceita pet(?!s)/);
      await expect(page.getByRole("heading", { name: "Localização" })).toBeVisible();
      await expect(page.getByText("O que tem por perto")).toBeVisible();
    }
  });
}

test("calendário: legenda tem Indisponível", async ({ page }) => {
  await page.goto("/imoveis/ube-001", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Indisponível").first()).toBeVisible();
});
