import { test, expect } from "@playwright/test";

/*
  T483 — MS-1 / PUBLICO-A (QA do Muse, 25/10): o menu "Mais" do topo público fecha ao rolar a página e ao clicar fora
  (além de Esc e de escolher um link).
*/
test.use({ viewport: { width: 1280, height: 900 } });

test.describe("T483 — o menu Mais fecha sozinho", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByTestId("menu-mais").click();
    await expect(page.getByTestId("menu-mais-lista")).toBeVisible();
  });

  test("ao rolar a página", async ({ page }) => {
    await page.screenshot({ path: "tests/laboratorio/saida/t483-mais-aberto-1280.png" });
    await page.mouse.wheel(0, 600);
    await expect(page.getByTestId("menu-mais-lista")).toHaveCount(0);
    await expect(page.getByTestId("menu-mais")).toHaveAttribute("aria-expanded", "false");
  });

  test("ao clicar fora", async ({ page }) => {
    await page.mouse.click(40, 600);
    await expect(page.getByTestId("menu-mais-lista")).toHaveCount(0);
  });

  test("com Esc", async ({ page }) => {
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("menu-mais-lista")).toHaveCount(0);
  });
});
