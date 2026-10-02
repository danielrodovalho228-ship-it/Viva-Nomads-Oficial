import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T12 — ESCADA DE PLANOS (@criticos)
 *
 * Regra 1: Gestor é plano de ELEGIBILIDADE — conta comum (<5 imóveis validados,
 *   não-administradora) NÃO consegue ativar; o card mostra critério + "Fale com
 *   a gente" (barreira como meta, nunca porta muda).
 * Regra 3: o simulador RECOMENDA o plano pelo volume real — e a recomendação
 *   MUDA conforme o volume digitado (inclusive "Gratuito" quando é o melhor).
 */
test.describe("T12 — Escada de planos @criticos", () => {
  test.describe("Regra 1 — Gestor por elegibilidade", () => {
    test.use({ storageState: authFile("proprietario") });

    test("conta comum não ativa Gestor: card mostra critério + 'Fale com a gente'", async ({
      page,
    }) => {
      await page.goto("/dashboard/assinatura", { waitUntil: "networkidle" });
      // O card do Gestor existe.
      const cardGestor = page
        .locator("div")
        .filter({ has: page.getByRole("heading", { name: /^Gestor$/ }) })
        .first();
      await expect(cardGestor).toBeVisible();
      // Não há botão de ativar/assinar o Gestor — só "Fale com a gente".
      await expect(cardGestor.getByRole("button", { name: /Assinar|Ativar|Plano atual/i })).toHaveCount(0);
      await expect(cardGestor.getByRole("link", { name: /Fale com a gente/i })).toBeVisible();
      // A barreira aparece como META (critério de desbloqueio), não porta muda.
      await expect(cardGestor).toContainText(/administradoras|documenta[çc][ãa]o aprovada|elegível/i);
    });

    test("a guarda do servidor recusa cobrança do Gestor (403)", async ({ request }) => {
      const res = await request.post("/api/assinatura", {
        data: { planId: "gestor", billingType: "PIX" },
      });
      // Nunca cobra o Gestor por auto-serviço (403), independente de elegibilidade.
      expect(res.status()).toBe(403);
    });
  });

  test.describe("Regra 3 — simulador recomenda pelo volume", () => {
    test.use({ storageState: authFile("proprietario") });

    test("a recomendação muda conforme o volume digitado", async ({ page }) => {
      await page.goto("/dashboard/simulador", { waitUntil: "networkidle" });
      const reco = page.getByTestId("plano-recomendado");
      await expect(reco).toBeVisible({ timeout: 10_000 });

      const aluguel = page.getByLabel(/Aluguel mensal pretendido/i);
      const mesesSlider = page.locator('input[type="range"]').first();

      // Cenário BAIXO volume/valor: aluguel modesto, prazo longo (poucos
      // contratos/ano) → o Gratuito tende a ser o melhor (assinatura não se paga).
      await aluguel.fill("3000");
      await mesesSlider.fill("6");
      await page.getByRole("button", { name: /^6 meses$/ }).click();
      await page.waitForTimeout(400);
      await expect(reco).toContainText(/Gratuito/i);

      // Cenário ALTO volume/valor: aluguel alto, muitos meses, prazo curto (mais
      // contratos/ano) → a economia de comissão supera a assinatura: sai do Grátis.
      await aluguel.fill("12000");
      await mesesSlider.fill("12");
      await page.getByRole("button", { name: /^2 meses$/ }).click();
      await page.waitForTimeout(400);
      await expect(reco).not.toContainText(/Gratuito/i);
      await expect(reco).toContainText(/Essencial|Profissional/i);
    });
  });
});
