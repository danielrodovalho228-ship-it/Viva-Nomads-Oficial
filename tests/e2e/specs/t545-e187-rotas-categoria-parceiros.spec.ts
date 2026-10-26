import { test, expect } from "@playwright/test";

/*
  T545 — E187: /parceiros/<categoria> não cai mais no 404. Limpeza, montagem e mudança abrem a busca de parceiros já
  filtrada (/parceiros/buscar?categoria=…); seguros e gestores levam aos tipos de parceria; fotografia, à página dos
  fotógrafos. Endereço desconhecido segue no 404.
*/
const SAIDA = "tests/laboratorio/saida";

test.describe("T545 — E187: rotas de categoria de parceiros", () => {
  for (const [rota, categoria] of [["limpeza", "limpeza"], ["montagem", "montagem"], ["mudancas", "mudanca"]] as const) {
    test(`/parceiros/${rota} → busca filtrada em ${categoria}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const r = await page.goto(`/parceiros/${rota}`, { waitUntil: "domcontentloaded" });
      expect(r?.status()).toBe(200);
      await expect(page).toHaveURL(new RegExp(`/parceiros/buscar\\?categoria=${categoria}$`));
      await expect(page.locator("#bp-categoria")).toHaveValue(categoria);
      await page.screenshot({ path: `${SAIDA}/t545-${rota}-390.png` });
    });
  }

  for (const rota of ["seguros", "gestores"]) {
    test(`/parceiros/${rota} → tipos de parceria`, async ({ page }) => {
      const r = await page.goto(`/parceiros/${rota}`, { waitUntil: "domcontentloaded" });
      expect(r?.status()).toBe(200);
      await expect(page).toHaveURL(/\/parceiros#tipos$/);
      await expect(page.getByTestId("parceiros-tipos")).toBeVisible();
    });
  }

  test("/parceiros/fotografia → página dos fotógrafos; endereço desconhecido segue no 404", async ({ page }) => {
    await page.goto("/parceiros/fotografia", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/parceiros\/fotografos$/);
    const r = await page.goto("/parceiros/nao-existe-e187", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBe(404);
  });
});
