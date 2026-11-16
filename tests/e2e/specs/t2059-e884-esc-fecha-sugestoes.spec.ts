import { test, expect } from "@playwright/test";

/*
  T2059 — E884 (Pista 3, bloco 2 da fila de 16/11) @E884 @ao-vivo-seguro — TRAVA NOMEADA: vermelha na main até a
  correção (PR #3807, claude-b/e884-busca-escape) entrar; vai junto com ela.
  Regra (decidida no #3807, docs/e884-busca-esc.md): na busca da home, com a lista de sugestões de cidade ABERTA, o Esc
  fecha a lista (e o foco fica no campo); digitar de novo reabre. Visitante, só leitura (não busca nada).
*/
test.use({ storageState: { cookies: [], origins: [] } });

for (const largura of [390, 1280] as const) {
  test(`T2059 — E884 a ${largura} px: Esc fecha as sugestões da busca da home e digitar reabre @E884 @ao-vivo-seguro`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const barra = page.getByTestId("barra-busca-home");
    const campo = page.locator("#busca-principal-local");
    const lista = barra.locator("ul");
    // O campo existe antes da hidratação: digita até a lista abrir.
    await expect(async () => {
      await campo.fill("");
      await campo.pressSequentially("Uber");
      await expect(lista).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await expect(lista.locator("li").first()).toBeVisible();
    await campo.press("Escape");
    await expect(lista, "Esc fecha a lista").toHaveCount(0);
    await expect(campo, "o foco continua no campo").toBeFocused();
    await expect(campo).toHaveValue("Uber");
    await campo.pressSequentially("l");
    await expect(lista, "digitar de novo reabre").toBeVisible();
  });
}
