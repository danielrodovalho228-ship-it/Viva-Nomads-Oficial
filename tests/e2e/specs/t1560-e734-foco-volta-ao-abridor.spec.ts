import { test, expect } from "@playwright/test";

/*
  T1560 — E734 (#3533, C17 da QA, WCAG 2.4.3): fechar "Mais filtros" devolve o foco ao botão que abriu (data-testid=pilula-mais),
  por Esc, pelo X e pelo fundo, a 1280 e a 390 px. É o T-C17 que a QA pediu (document.activeElement === pilula-mais).
  Valor de guarda: na main de hoje o Esc manda o foco para "Pular para o conteúdo"; este PR (base = ramo do #3533) passa com a correção.
  Quando o #3533 for mesclado, o test.fail do C17 na t1486 passa a "passar quando devia falhar": remover o test.fail lá, no mesmo dia.
*/
test.use({ storageState: { cookies: [], origins: [] } });

const ativo = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.tagName ?? "");

for (const [w, h] of [[1280, 900], [390, 844]] as const) {
  for (const como of ["Esc", "X", "fundo"] as const) {
    test(`a ${w} px: fechar Mais filtros por ${como} devolve o foco ao botão`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/buscar", { waitUntil: "domcontentloaded" });
      const mais = page.getByTestId("pilula-mais");
      await expect(mais).toBeVisible({ timeout: 30_000 });
      await mais.focus();
      await page.keyboard.press("Enter");
      const folha = page.getByRole("dialog");
      await expect(folha).toBeVisible();
      if (como === "Esc") await page.keyboard.press("Escape");
      else if (como === "X") await folha.getByRole("button", { name: "Fechar" }).first().click();
      else await page.locator(".bs-backdrop").click({ position: { x: 4, y: 4 } });
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(await ativo(page), "foco depois de fechar").toBe("pilula-mais");
    });
  }
}
