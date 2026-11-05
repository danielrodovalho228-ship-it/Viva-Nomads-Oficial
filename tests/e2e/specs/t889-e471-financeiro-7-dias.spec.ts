import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T889 — E471 (AD2): no Financeiro do admin, clicar "7 dias" mudava a URL, mas o destaque, as datas De/Até e o rótulo
 * ficavam em 30 dias. Agora o clique aplica o período inteiro: destaque em "7 dias", datas dos últimos 7 dias e
 * rótulo "(7 dias)"; e de volta para "30 dias", tudo volta junto. 390 e 1280 px.
 */
const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
function hojeBRT(): string {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}
const menos = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

test.describe("T889 — E471: preset de período do Financeiro aplica tudo", () => {
  test.use({ storageState: authFile("admin") });

  for (const largura of [390, 1280]) {
    test(`a ${largura}px: "7 dias" aplica destaque, datas e rótulo; "30 dias" volta`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto("/admin/financeiro?periodo=30", { waitUntil: "domcontentloaded" });
      const presets = page.getByTestId("filtro-periodo-preset");
      await expect(presets.filter({ hasText: "30 dias" })).toHaveAttribute("aria-current", "true", { timeout: 30_000 });

      const hoje = hojeBRT();
      await presets.filter({ hasText: "7 dias" }).click();
      await expect(page).toHaveURL(/periodo=7/);
      await expect(presets.filter({ hasText: "7 dias" })).toHaveAttribute("aria-current", "true", { timeout: 30_000 });
      await expect(presets.filter({ hasText: "30 dias" })).not.toHaveAttribute("aria-current", "true");
      await expect(page.locator("main")).toContainText("(7 dias)");
      await expect(page.locator("main")).not.toContainText("(30 dias)");
      const datas = page.getByRole("group", { name: "Período" }).locator("xpath=..").locator("form").first().locator("input");
      await expect(datas.nth(0)).toHaveValue(dataBR(menos(hoje, 6)));
      await expect(datas.nth(1)).toHaveValue(dataBR(hoje));

      await presets.filter({ hasText: "30 dias" }).click();
      await expect(presets.filter({ hasText: "30 dias" })).toHaveAttribute("aria-current", "true", { timeout: 30_000 });
      await expect(page.locator("main")).toContainText("(30 dias)");
      await expect(datas.nth(0)).toHaveValue(dataBR(menos(hoje, 29)));
    });
  }
});
