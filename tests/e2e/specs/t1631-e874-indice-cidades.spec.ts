import { test, expect } from "@playwright/test";

/*
  T1631 — E874: /cidades é o índice (lista + contagem igual à da página da cidade); /cidades/sao-paulo diz que a Viva
  ainda não opera lá (status 200, noindex, pedido de moradia), e /cidades/xpto123 segue 404.
*/
test.describe("E874 — índice de cidades e cidade sem operação", () => {
  test("índice: Uberlândia com a mesma contagem da página dela", async ({ page }) => {
    const r = await page.goto("/cidades", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBe(200);
    expect(page.url()).toMatch(/\/cidades$/);
    const item = page.locator('[data-testid="indice-cidade"][data-cidade="uberlandia"]');
    await expect(item).toBeVisible();
    const total = Number(await item.getAttribute("data-total"));
    expect(total).toBeGreaterThan(0);
    await expect(item.getByTestId("indice-cidade-total")).toHaveText(`${total} ${total === 1 ? "imóvel" : "imóveis"}`);
    await item.click();
    await expect(page).toHaveURL(/\/cidades\/uberlandia$/);
    await expect(page.getByTestId("cidade-contagem")).toContainText(String(total));
  });

  test("cidade sem operação: página própria, sem 404 seco, fora do índice", async ({ page }) => {
    const r = await page.goto("/cidades/sao-paulo", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveText("Ainda não operamos em São Paulo");
    await expect(page.getByTestId("cidade-sem-operacao-pedido")).toHaveAttribute("href", "/pedidos/novo?cidade=S%C3%A3o%20Paulo");
    await expect(page.getByTestId("cidade-sem-operacao-cidades")).toHaveAttribute("href", "/cidades");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("slug que não é cidade segue 404", async ({ page }) => {
    const r = await page.goto("/cidades/xpto123", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBe(404);
  });
});
