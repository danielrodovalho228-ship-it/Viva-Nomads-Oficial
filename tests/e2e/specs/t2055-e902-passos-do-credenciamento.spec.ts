import { test, expect } from "@playwright/test";

/*
  T2055 — E902 (Pista 3; autorizado pelo Gerente em 16/11) @E902 @ao-vivo-seguro
  Regra: em /parceiros, o link "Ver os passos do credenciamento" (convite de Avaliação de imóveis no Seja parceiro) leva
  à página PÚBLICA de recrutamento, /parceiros/avaliadores — não à área logada (/dashboard/parceiro/avaliacao).
  Visitante, só leitura (não envia o formulário).
*/
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("T2055 — E902: Ver os passos do credenciamento abre a página pública @E902 @ao-vivo-seguro", () => {
  test("o link aponta para /parceiros/avaliadores e abre sem login", async ({ page }) => {
    await page.goto("/parceiros", { waitUntil: "domcontentloaded" });
    const convite = page.getByTestId("sp-convite-avaliacao");
    await expect(convite).toBeAttached({ timeout: 30_000 });
    const link = convite.getByRole("link", { name: "Ver os passos do credenciamento" });
    await expect(link).toHaveAttribute("href", "/parceiros/avaliadores");
    await expect(page.locator('a[href^="/dashboard/parceiro/avaliacao"]')).toHaveCount(0);
    const r = await page.request.get("/parceiros/avaliadores", { maxRedirects: 0 });
    expect(r.status(), "a página de recrutamento é pública (sem redirecionar para o login)").toBe(200);
  });
});
