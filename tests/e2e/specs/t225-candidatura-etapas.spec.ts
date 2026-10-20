import { test, expect } from "@playwright/test";

/**
 * T225 — Candidatura em etapas (ordem eb4b11d8, Pacote Clareza UX5), 390 e 1280 px.
 * Anúncio de exemplo (ube-002): percorre Revisar → Mensagem → Confirmar sem gravar nada.
 */
for (const largura of [390, 1280]) {
  test.describe(`T225 — Candidatura em etapas (${largura} px)`, () => {
    test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: largura, height: 900 } });

    test("barra de progresso, mensagem opcional e confirmação com termos", async ({ page }) => {
      await page.goto("/imoveis/ube-002", { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Enviar candidatura" }).locator("visible=true").first().click();
      const passo = page.getByTestId("solicitacao-passo");
      await expect(passo).toBeVisible();
      await expect(passo.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "33");
      await expect(passo.getByTestId("candidatura-detalhes")).toContainText("Caução");

      await passo.getByRole("button", { name: "Continuar" }).click();
      await expect(passo.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "67");
      await expect(passo.getByTestId("candidatura-apresentacao")).toBeVisible();
      await passo.getByTestId("candidatura-apresentacao").fill("Olá! Vou trabalhar remoto por alguns meses.");

      await passo.getByRole("button", { name: "Continuar" }).click();
      await expect(passo.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
      await expect(passo).toContainText("concordo com os termos de uso");
      await expect(passo).toContainText("Olá! Vou trabalhar remoto");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: `test-results/t225-confirmar-${largura}.png` });

      await passo.getByRole("button", { name: "Voltar" }).click();
      await expect(passo.getByTestId("candidatura-apresentacao")).toHaveValue(/remoto/);
    });
  });
}
