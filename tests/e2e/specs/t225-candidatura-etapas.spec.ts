import { test, expect } from "@playwright/test";

/**
 * T225 — Candidatura em etapas (ordem eb4b11d8, Pacote Clareza UX5), 390 e 1280 px.
 * Anúncio de exemplo (ube-002): declara o exemplo no 1º passo, sem passos e sem "Continuar" (E694).
 */
for (const largura of [390, 1280]) {
  test.describe(`T225 — Candidatura em anúncio de exemplo (${largura} px)`, () => {
    test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: largura, height: 900 } });

    // E694: o anúncio de exemplo se declara NO PRIMEIRO passo — sem barra de passos, sem "Continuar" (ninguém preenche 3
    // passos para descobrir no fim) — e fecha por "Entendi", pelo X e pelo Esc. Os 3 passos de verdade (Revisar → Mensagem →
    // Confirmar) são de anúncio real: t327 os percorre.
    test("o exemplo avisa de cara, sem passos nem Continuar, e fecha", async ({ page }) => {
      await page.goto("/imoveis/ube-002", { waitUntil: "domcontentloaded" });
      const passo = page.getByTestId("solicitacao-passo");
      // Página fria: o clique pode cair antes da hidratação. Clica de novo até o passo aparecer.
      const abrir = async () =>
        expect(async () => {
          await page.getByRole("button", { name: "Pedir para morar", exact: true }).locator("visible=true").first().click();
          await expect(passo).toBeVisible({ timeout: 3_000 });
        }).toPass({ timeout: 30_000 });
      await abrir();
      await expect(passo.getByTestId("solicitacao-demo")).toBeVisible();
      await expect(passo.getByTestId("candidatura-progresso")).toHaveCount(0);
      await expect(passo.getByRole("button", { name: "Continuar" })).toHaveCount(0);
      await expect(passo.getByRole("button", { name: "Enviar candidatura" })).toHaveCount(0);
      await expect(passo.getByTestId("candidatura-detalhes")).toContainText("Caução");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: `test-results/t225-exemplo-${largura}.png` });

      await passo.getByRole("button", { name: "Entendi" }).click();
      await expect(passo).toHaveCount(0);

      // E518: em qualquer passo o diálogo fecha pelo Esc e pelo X.
      await abrir();
      await page.keyboard.press("Escape");
      await expect(passo).toHaveCount(0);
      await abrir();
      await passo.getByTestId("solicitacao-fechar").click();
      await expect(passo).toHaveCount(0);
    });
  });
}
