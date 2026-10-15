import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T91 — Preço justo (ordem 4c74ac38, item 1): no passo de preço do cadastro, "Comparar com o Airbnb" mostra
 * o que o dono recebe lá e na Viva e o botão "Usar preço sugerido" preenche o aluguel. 390 px.
 * Taxa = a da faixa do dono; a conta de teste tem poucos imóveis ativos (faixa de 12%): R$ 10.300 em 2 meses
 * no Airbnb (taxa 16%) → recebe R$ 8.652; preço sugerido R$ 4.916/mês.
 */
test.describe("T91 — Preço sugerido no cadastro", () => {
  test.use({ storageState: authFile("proprietario"), viewport: { width: 390, height: 844 } });

  test("compara com o Airbnb e usa o preço sugerido", async ({ page }) => {
    await page.goto("/dashboard/imoveis/novo", { waitUntil: "networkidle" });
    // Abre o passo de preço pelo rascunho local (mesma chave que a tela usa: vivanomads-*:<id do usuário>).
    await page.evaluate(() => {
      const bruto = Object.entries(localStorage).find(([k]) => /^sb-.*-auth-token$/.test(k))?.[1];
      const id = bruto ? JSON.parse(bruto)?.user?.id : null;
      if (id) localStorage.setItem(`vivanomads-novo-draft:${id}`, JSON.stringify({ step: 5, monthlyPrice: "" }));
    });
    await page.reload({ waitUntil: "networkidle" });
    const retomar = page.getByRole("button", { name: /Continuar|Retomar/ }).first();
    if (await retomar.isVisible().catch(() => false)) await retomar.click();
    const bloco = page.getByTestId("preco-sugerido");
    test.skip((await bloco.count()) === 0, "passo de preço não abriu pelo rascunho local nesta conta");
    await bloco.getByRole("button", { name: /Comparar com o Airbnb/ }).click();
    await bloco.getByPlaceholder("10300").fill("10300");
    await expect(page.getByTestId("recebe-airbnb")).toContainText("8.652");
    await expect(bloco).toContainText("4.916");
    await bloco.getByRole("button", { name: "Usar preço sugerido" }).click();
    await expect(page.locator('input[placeholder="3200"]')).toHaveValue("4916");
    await page.screenshot({ path: "tests/laboratorio/saida/t91-preco-sugerido.png", fullPage: true });
  });
});
