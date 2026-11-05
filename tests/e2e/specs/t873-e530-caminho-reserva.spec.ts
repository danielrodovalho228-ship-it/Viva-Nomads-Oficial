import { test, expect } from "@playwright/test";

/**
 * T873 — E530: no anúncio de exemplo, "Ver o caminho de reserva" abre os passos do morador ali mesmo (antes só rolava
 * até o cartão de preço, ao lado). Os passos são os mesmos do Como funciona e há o link para o passo a passo completo.
 */
for (const [nome, largura, altura] of [["1280", 1280, 900], ["390", 390, 844]] as const) {
  test(`T873 — ${nome} px: o caminho de reserva abre com os passos`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: altura });
    await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
    const dias = page.locator('button[data-estado-dia="disponivel"]');
    await expect(dias.first()).toBeVisible({ timeout: 20_000 });
    const total = await dias.count();
    await dias.nth(0).click();
    await dias.nth(Math.min(total - 1, 31)).click();
    const caminho = page.getByTestId("caminho-reserva");
    await expect(caminho).toBeVisible();
    const yAntes = await page.evaluate(() => window.scrollY);
    await caminho.getByText("Ver o caminho de reserva").click();
    const passos = page.getByTestId("caminho-reserva-passos");
    await expect(passos).toBeVisible();
    for (const t of ["Busque", "Converse", "Candidate-se", "Assine"]) await expect(passos).toContainText(t);
    await expect(caminho.getByRole("link", { name: "Como funciona, passo a passo" })).toHaveAttribute("href", "/como-funciona#para-inquilinos");
    expect(page.url()).not.toContain("#cartao-preco");
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - yAntes)).toBeLessThan(200); // não salta para outro ponto
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
