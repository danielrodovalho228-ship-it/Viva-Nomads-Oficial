import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T107 — Admin: a tela do chamado (/admin/atendimento/[id]) nunca mostra código de status
 * (ex.: pendente_aceite) — só texto humano (ordem 0569d129 item 2, achado do Moacir no #595).
 */
test.describe("T107 — Admin: chamado sem código de status", () => {
  test.use({ storageState: authFile("admin") });

  for (const largura of [390, 1280]) {
    test(`tela do chamado sem "_" de status a ${largura}px`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/admin/atendimento?aba=fila", { waitUntil: "domcontentloaded" });
      const link = page.locator('main a[href^="/admin/atendimento/"]').first();
      test.skip((await link.count()) === 0, "Sem chamado na fila deste ambiente.");
      await link.click();
      await expect(page).toHaveURL(/\/admin\/atendimento\/[0-9a-f-]{36}$/);
      await expect(page.locator("main")).toBeVisible();
      // Dá tempo ao copiloto ("quem é a pessoa") carregar antes de varrer o texto.
      await page.getByTestId("quem-e-a-pessoa").first().waitFor({ timeout: 15_000 }).catch(() => undefined);
      const texto = await page.locator("main").innerText();
      const codigos = texto.match(/\b(?:pendente_aceite|aguardando_[a-z_]+|encerrado_[a-z_]+|em_andamento|removido_admin)\b/g) ?? [];
      expect(codigos, `códigos de status visíveis: ${codigos.join(", ")}`).toEqual([]);
    });
  }
});
