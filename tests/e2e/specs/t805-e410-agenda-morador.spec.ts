import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/*
  T805 — E410 (01/11): no painel da MORADORA, a Agenda (visitas) mostrava textos do proprietário — "todos os seus imóveis"
  e "Quando você anunciar… / Anunciar imóvel". Conta de teste do inquilino (só morador): o texto é o dela e leva a
  Visitas. 390 e 1280.
*/
const SAIDA = "tests/laboratorio/saida";
test.use({ storageState: authFile("inquilino") });

for (const largura of [390, 1280] as const) {
  test(`T805 — Agenda no papel morador (${largura} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    await page.goto("/dashboard/agenda", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    const main = page.locator("main");
    await expect(main.getByRole("heading", { name: "Agenda" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("agenda-morador")).toBeVisible();
    await expect(main).not.toContainText(/todos os seus imóveis|Quando você anunciar|Anunciar imóvel/);
    await expect(main.getByRole("link", { name: "Ver minhas visitas" })).toHaveAttribute("href", "/dashboard/visitas");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `${SAIDA}/t805-agenda-morador-${largura}.png` });
  });
}
