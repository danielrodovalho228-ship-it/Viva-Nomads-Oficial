import { test, expect } from "@playwright/test";

/*
  T1455 — E694 (#3339, na main), jornada provada pela Pista QA (rodada de 07/11, "T-E694"): o visitante, no anúncio de EXEMPLO
  (/imoveis/ube-005), não vê as ações que não funcionam. Só o caminho "Ver imóveis reais" (→ /buscar); nenhum "Pedir para morar",
  "Agendar visita", "Enviar mensagem" nem "Visita por vídeo"; nenhum "Enviar" visível; nenhum texto de validação em vermelho
  ("Escolha a data de entrada para continuar."). A explicação de que o anúncio é de exemplo aparece. 390 e 1280 px, sem estouro.
*/
test.describe("T1455 — E694: o anúncio de exemplo só explica", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: só "Ver imóveis reais", sem ação que não funciona`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      const r = await page.goto("/imoveis/ube-005", { waitUntil: "domcontentloaded" });
      expect(r?.status() ?? 0).toBeLessThan(400);
      await expect(page.getByText(/Este anúncio é de exemplo|anúncio de exemplo/i).filter({ visible: true }).first()).toBeVisible({ timeout: 30_000 });
      const reais = page.getByRole("link", { name: /Ver imóveis reais/i }).filter({ visible: true });
      await expect(reais.first()).toBeVisible();
      expect(await reais.first().getAttribute("href")).toMatch(/\/buscar/);
      for (const nome of [/Pedir para morar/i, /Agendar visita/i, /Enviar mensagem/i, /Visita por vídeo/i]) {
        await expect(page.getByRole("button", { name: nome }).filter({ visible: true }), `ação ${nome} não deve estar visível`).toHaveCount(0);
        await expect(page.getByRole("link", { name: nome }).filter({ visible: true }), `link ${nome} não deve estar visível`).toHaveCount(0);
      }
      await expect(page.getByRole("button", { name: /^Enviar$/ }).filter({ visible: true })).toHaveCount(0);
      await expect(page.getByText("Escolha a data de entrada para continuar.")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    });
  }
});
