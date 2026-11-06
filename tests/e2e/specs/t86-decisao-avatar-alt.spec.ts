import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";

/**
 * T86 — PROVAS QUE FALTAVAM (ordens 562d581e e 5c75910b, Moacir 15/10/2026).
 * 1) [removida no E595/E596, 05/11: a /decisao foi eliminada] /decisao (#519): a duração do contrato era editável e a tela comparava a regra
 *    antiga (só o 1º mês) com a nova (valor total do contrato), a 390 e 1280 px.
 *    A página é dos sócios: usa o cookie vn_socios derivado do código
 *    (SOCIOS_ACCESS_CODE); sem o código o teste se pula, nunca passa em falso.
 * 2) #536: o avatar do proprietário de exemplo mostra "P" (nunca "P(") e o
 *    capa da Visão geral do dono tem o alt com "sala mobiliada".
 */
// E595/E596 (05/11): a /decisao foi eliminada (modelo revogado); a parte 1 desta prova saiu junto. Fica o #536.

test.describe("T86 — #536: avatar sem 'P(' e alt 'imóvel mobiliado'", () => {
  test("avatar do proprietário de exemplo mostra só as iniciais, nunca '('", async ({ page }) => {
    await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
    const card = page.getByTestId("sobre-proprietario");
    test.skip((await card.count()) === 0, "imóvel de exemplo não está no ar neste ambiente.");
    // "Helena M. (exemplo)" → "HM" (o que está entre parênteses nunca entra no avatar).
    const avatar = card.locator("div[aria-hidden]").filter({ hasText: /^\p{Lu}{1,2}$/u }).first();
    await expect(avatar).toHaveText(/^\p{Lu}{1,2}$/u);
    await expect(page.locator("body")).not.toContainText(/\b\p{Lu}\($/u);
    await expect(card.locator("div[aria-hidden]").filter({ hasText: "(" })).toHaveCount(0);
  });

  test.describe("banner da Visão geral do dono", () => {
    test.skip(!hasAccount("proprietario"), "conta de teste do proprietário não configurada");
    test.use({ storageState: authFile("proprietario") });

    test("Visão geral do dono sem capa de foto (Prompt 42) e nenhum alt 'apartamento mobiliado'", async ({ page }) => {
      // "networkidle" estourava 45 s no lab (a Visão geral mantém requisições abertas): basta o HTML.
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await expect(page.locator("main h1:visible").first()).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('[data-testid="painel-capa"]')).toHaveCount(0);
      await expect(page.getByAltText(/apartamento mobiliado/i)).toHaveCount(0);
    });
  });
});
