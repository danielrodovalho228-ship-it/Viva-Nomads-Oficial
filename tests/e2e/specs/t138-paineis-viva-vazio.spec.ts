import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T138 — ordem 8f0582d6 (D6 e D8), painéis a 390 px:
 *  - o botão "Fale com a Viva" não cobre o último card. Desde o E246 (#1536) ele nem aparece no painel do celular
 *    (< 768 px, `painel && "max-md:hidden"`; a Viva segue em Conta › Ajuda), então a prova a 390 é que ele some; no
 *    computador ele fica na faixa reservada (t649, E246 a 1280);
 *  - estado vazio sem ilustração mostra o ícone em círculo de destaque (padrão de Mensagens).
 */
test.describe("T138 — painéis 390 px", () => {
  test.use({ storageState: authFile("inquilino"), viewport: { width: 390, height: 844 } });

  for (const rota of ["/dashboard/ferramentas", "/dashboard/favoritos", "/dashboard/candidaturas"]) {
    test(`${rota}: o botão da Viva não cobre o fim do conteúdo (E246: no painel do celular ele some)`, async ({ page }) => {
      await page.goto(rota, { waitUntil: "domcontentloaded" });
      await page.locator("main").first().waitFor({ timeout: 20_000 });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await expect(page.getByTestId("fale-com-a-viva")).toBeHidden({ timeout: 20_000 });
    });
  }

  test("estados vazios: ícone pequeno, sem ilustração e com um próximo passo (revisto no Prompt 48)", async ({ page }) => {
    for (const rota of ["/dashboard/buscas", "/dashboard/candidaturas", "/dashboard/comparar"]) {
      await page.goto(rota, { waitUntil: "domcontentloaded" });
      const vazio = page.getByTestId("estado-vazio").first();
      if (!(await vazio.isVisible().catch(() => false))) continue; // conta com dados: nada a provar aqui
      await expect(vazio.locator("img")).toHaveCount(0);
      await expect(vazio.getByTestId("estado-vazio-acao").locator("a, button").first()).toBeVisible();
      const icone = vazio.getByTestId("estado-vazio-icone");
      if ((await icone.count()) === 0) continue;
      const c = await icone.boundingBox();
      expect(c!.width, `${rota}: ícone pequeno`).toBeLessThanOrEqual(24);
    }
  });

});
