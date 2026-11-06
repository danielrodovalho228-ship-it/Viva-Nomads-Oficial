import { test, expect } from "@playwright/test";

/*
  T1301 — E370: o formulário do pedido de moradia mostra a regra de validade desde o início (antes só depois de digitar a entrada),
  e ganha a data exata quando a entrada entra. 390 e 1280, página pública.
*/
for (const [largura, altura] of [[390, 844], [1280, 900]] as const) {
  test(`a ${largura} px: a validade aparece sem data de entrada e ganha o cálculo com ela`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: altura });
    await page.goto("/pedidos/novo", { waitUntil: "domcontentloaded" });
    const validade = page.getByTestId("pedido-validade");
    await expect(validade).toBeVisible({ timeout: 30_000 });
    await expect(validade).toContainText("30 dias");
    await expect(validade).toHaveAttribute("data-calculada", "0");
    await page.goto("/pedidos/novo?inicio=2099-01-10&meses=3", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("pedido-validade")).toHaveAttribute("data-calculada", "1", { timeout: 30_000 });
    await expect(page.getByTestId("pedido-validade")).toContainText("fica no ar até");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });
}
