import { test, expect } from "@playwright/test";

/**
 * T196 — ordem 335b4064 (cidades liberadas, item 3): quem pede moradia em cidade ainda fechada vê o convite
 * "A Viva ainda não chegou em <cidade>…"; em Uberlândia (liberada) o convite não aparece. 390 e 1280 px, sem rolagem lateral.
 * Roda depois da migração 0159 (a Action de produção aplica no merge).
 */
for (const largura of [390, 1280]) {
  test(`${largura} px: /pedidos/novo convida a deixar interesse em cidade fechada e não em Uberlândia`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });

    await page.goto("/pedidos/novo?cidade=Goi%C3%A2nia&uf=GO", { waitUntil: "domcontentloaded" });
    const convite = page.getByTestId("convite-cidade");
    await expect(convite).toContainText("A Viva ainda não chegou em Goiânia. Deixe seu interesse e avisamos quando abrir.", { timeout: 15_000 });
    // Visitante sem login: o convite leva a entrar (nada é gravado sem sessão).
    await expect(convite.getByRole("link", { name: /Entrar para deixar meu interesse/ })).toBeVisible();

    await page.goto("/pedidos/novo?cidade=Uberl%C3%A2ndia&uf=MG", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("pedido-formulario")).toBeVisible();
    await expect(page.getByTestId("convite-cidade")).toHaveCount(0);

    const semRolagemLateral = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    expect(semRolagemLateral).toBe(true);
  });
}

test("visitante não entra em /admin/cidades", async ({ page }) => {
  await page.goto("/admin/cidades", { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/admin\/cidades$/);
});
