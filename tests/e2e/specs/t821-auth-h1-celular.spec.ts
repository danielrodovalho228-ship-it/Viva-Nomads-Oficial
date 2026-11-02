import { test, expect } from "@playwright/test";

/*
  T821 — títulos (02/11, Pista A): a tela de entrar tem um h1 VISÍVEL em todas as larguras — o título do formulário.
  Antes, no celular, o único h1 morava no cartaz da foto (escondido abaixo do lg) e a página ficava sem título principal.
*/
for (const largura of [390, 1280] as const) {
  test(`T821 — /auth com um h1 visível (${largura} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    await page.goto("/auth?senha=1", { waitUntil: "domcontentloaded" });
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toHaveCount(1, { timeout: 30_000 });
    await expect(h1).toBeVisible();
    await expect(h1).toHaveText("Entrar com senha");
    await page.goto("/auth", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Entre ou crie sua conta", { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
}
