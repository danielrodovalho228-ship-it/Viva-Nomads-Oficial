import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/*
  T2120 — E991: em Admin › Usuários, a tabela cabe no quadro em 1280 (a QA mediu a tabela com 1021 px num quadro de
  862 px: as colunas da direita — Tipo da conta e Conta de teste — ficavam fora e só com rolagem lateral).
  Em 390 a lista é de cartões (a tabela não aparece) e também não passa da tela.
*/
test.use({ storageState: authFile("admin") });

test("1280: a tabela de usuários cabe no quadro (sem rolagem lateral) e mostra Tipo da conta e Conta de teste", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/admin/usuarios", { waitUntil: "domcontentloaded" });
  const quadro = page.getByTestId("admin-usuarios-lista").locator("div.overflow-x-auto").first();
  await expect(quadro.locator("table tbody tr").first()).toBeVisible({ timeout: 30_000 });
  const m = await quadro.evaluate((el) => ({ quadro: el.clientWidth, tabela: el.scrollWidth, pagina: document.documentElement.scrollWidth, tela: window.innerWidth }));
  expect(m.tabela, `tabela ${m.tabela}px num quadro de ${m.quadro}px`).toBeLessThanOrEqual(m.quadro);
  expect(m.pagina).toBeLessThanOrEqual(m.tela);
  // As duas últimas colunas aparecem inteiras dentro do quadro.
  const caixa = (await quadro.boundingBox())!;
  for (const nome of ["Tipo da conta", "Conta de teste"]) {
    const th = (await quadro.locator("th", { hasText: nome }).boundingBox())!;
    expect(th.x + th.width, nome).toBeLessThanOrEqual(caixa.x + caixa.width + 1);
  }
});

test("390: a lista de cartões não passa da tela", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/usuarios", { waitUntil: "domcontentloaded" });
  await expect(page.locator("li[data-usuario]").first()).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
