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

    test("não há cobrança de plano por auto-serviço: a rota de assinatura saiu (E237)", async ({ request }) => {
      const res = await request.post("/api/assinatura", {
        data: { planId: "gestor", billingType: "PIX" },
      });
      expect(res.status()).toBe(404);
    });
  });

  test.describe("Regra 3 — simulador mostra a taxa pela faixa de imóveis ativos", () => {
    test.use({ storageState: authFile("proprietario") });

    test("a taxa muda conforme o número de imóveis ativos (sem planos nem mensalidade)", async ({ page }) => {
      await page.goto("/dashboard/simulador", { waitUntil: "networkidle" });
      const ativos = page.getByTestId("imoveis-ativos");
      const taxa = page.getByTestId("taxa-faixa");
      await expect(taxa).toBeVisible({ timeout: 10_000 });
      const slider = page.locator("#imoveis-ativos");

      // Faixas vigentes (ordem 75553f0a): 1–2 → 12%, 3–5 → 10%, 6–15 → 8%, 16–30 → 6%, 31+ → taxa negociável (E252-B: não é o Plano Gestor).
      const casos: Array<[string, RegExp]> = [
        ["1", /12%/],
        ["3", /10%/],
        ["6", /8%/],
        ["16", /6%/],
        ["31", /Negociado/i],
      ];
      for (const [n, esperado] of casos) {
        await slider.fill(n);
        await expect(ativos).toHaveText(n);
        await expect(taxa).toHaveText(esperado);
      }

      const corpo = (await page.locator("body").innerText()) ?? "";
      expect(corpo).not.toMatch(/Recomendado para você|Gratuito|Essencial|Profissional|mensalidade/i);
    });
  });
});
