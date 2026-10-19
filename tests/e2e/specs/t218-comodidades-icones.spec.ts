import { test, expect } from "@playwright/test";

/**
 * T218 — Comodidades com ícone por item (ordem 0b1c00c6), pública, 390 e 1280 px.
 * Cada comodidade da página e da lista completa ("Ver todas") traz um ícone próprio;
 * as colunas são pares (2) e não há rolagem lateral.
 */
for (const largura of [390, 1280]) {
  test(`T218 — /imoveis/ube-001: comodidades com ícone e "Ver todas" a ${largura} px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });

    const principais = page.getByTestId("comodidades-principais");
    await principais.scrollIntoViewIfNeeded();
    const itens = principais.getByTestId("comodidade-item");
    const n = await itens.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const svg = itens.nth(i).locator("svg");
      await expect(svg).toHaveCount(1);
      await expect(svg).toHaveAttribute("aria-hidden", "true");
    }
    const colunas = await principais.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
    expect(colunas % 2).toBe(0);

    const verTodas = page.getByTestId("comodidades-ver-todas");
    await verTodas.click();
    const lista = page.getByTestId("comodidades-lista-completa");
    await expect(lista).toBeVisible();
    const todos = lista.getByTestId("comodidade-item");
    const total = await todos.count();
    expect(total).toBeGreaterThanOrEqual(n);
    for (let i = 0; i < total; i++) await expect(todos.nth(i).locator("svg")).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });
}
