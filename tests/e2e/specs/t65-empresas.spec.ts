import { test, expect } from "@playwright/test";

/**
 * T65 — ordem cdef67f8: página /empresas.
 * Link no menu, passos, FAQ e texto sem "aluguel"; sem rolagem lateral a 390 px.
 */
test("/empresas: menu, passos, FAQ e sem rolagem lateral a 390 px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await expect(page.locator("header").getByRole("link", { name: "Empresas", exact: true }).first()).toBeVisible();

  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/empresas");
  await expect(page.getByTestId("empresas-como-funciona")).toBeVisible();
  await expect(page.getByTestId("empresas-faq")).toBeVisible();
  await expect(page.getByText(/recibo mensal da estadia/i).first()).toBeVisible();
  expect(await page.locator("main").innerText()).not.toMatch(/alugu/i);
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(sobra).toBeLessThanOrEqual(1);
});
