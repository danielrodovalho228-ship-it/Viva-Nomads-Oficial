// ORDEM-DUET-534 (Gerente, 22/11/2026): a última faixa PUBLICADA passa de "16 ou mais" / "16+" a "16–19" (a partir de 20, a linha de carteiras, sem percentual). As asserções deste arquivo que cobravam "16 ou mais" foram ajustadas por essa decisão; o cálculo não mudou.
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
 *
 * Asserções alteradas pelo prompt 078 (Daniel, 16/11/2026): no simulador do painel a escada termina em "16–19 = 6%"
 * — o controle de imóveis vai de 1 a 16 e não existe mais a posição 20 = Plano Gestor, 4%.
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

      // 078 (Daniel, 16/11/2026): faixas vigentes — 1–2 → 12%, 3–5 → 10%, 6–15 → 8%, 16 ou mais → 6%. Antes havia o
      // quinto caso ["20", /4%/] (20+ = Plano Gestor): a faixa saiu, e o controle agora termina em 16 (max={16}).
      const casos: Array<[string, RegExp]> = [
        ["1", /12%/],
        ["3", /10%/],
        ["6", /8%/],
        ["15", /8%/],
        ["16", /6%/],
      ];
      for (const [n, esperado] of casos) {
        await slider.fill(n);
        await expect(ativos).toHaveText(n);
        await expect(taxa).toHaveText(esperado);
      }
      // 078 (Daniel, 16/11/2026): no lugar de "20 → 4%": o controle para em 16, a última faixa é "16–19 imóveis" a 6%, e a
      // tela não mostra 4% nem o detalhe da faixa do Gestor.
      await expect(slider).toHaveAttribute("max", "16");
      await expect(taxa).toHaveText("6%");
      await expect(page.getByTestId("faixa-nome")).toHaveText("Sua faixa: 16–19 imóveis");
      await expect(page.getByTestId("faixa-gestor-detalhe")).toHaveCount(0);

      const corpo = (await page.locator("body").innerText()) ?? "";
      expect(corpo).not.toMatch(/Recomendado para você|Gratuito|Essencial|Profissional|mensalidade/i);
      expect(corpo).not.toMatch(/Plano Gestor/i); // 078 (Daniel, 16/11/2026): o simulador não nomeia mais o Plano Gestor.
    });
  });
});
