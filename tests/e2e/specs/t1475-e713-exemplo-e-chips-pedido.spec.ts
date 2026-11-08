import { test, expect } from "@playwright/test";

/*
  T1475 — dois merges da Pista A que ainda não tinham spec de tela. Visitante, 390 e 1280 px, sem estouro horizontal.
    E713 (#3365): no anúncio de EXEMPLO (/imoveis/ube-005), escolher as datas no calendário NÃO termina no aviso morto
       "esta solicitação não é enviada": aparece a explicação (as datas só simulam o valor) e a saída "Ver imóveis reais" (/buscar).
    /pedidos/novo (#3360): a 390 px os botões de marca e de internet quebram o rótulo em até 2 linhas, sem reticências e sem corte.
*/
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("T1475 — E713 e chips do /pedidos/novo (visitante)", () => {
  for (const w of [1280, 390] as const) {
    test(`E713 a ${w} px: datas do exemplo levam à explicação e a "Ver imóveis reais"`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      const r = await page.goto("/imoveis/ube-005", { waitUntil: "domcontentloaded" });
      expect(r?.status() ?? 0).toBeLessThan(400);
      const dias = page.locator('button[data-estado-dia="disponivel"]');
      await expect(dias.first()).toBeAttached({ timeout: 30_000 });
      await dias.first().scrollIntoViewIfNeeded();
      await dias.first().click();
      await dias.nth(3).click();
      const caixa = page.getByTestId("calendario-exemplo");
      await expect(caixa).toBeVisible();
      await expect(caixa).toContainText(/simular o valor/);
      await expect(page.getByText("esta solicitação não é enviada")).toHaveCount(0);
      const ver = page.getByTestId("calendario-exemplo-ver-reais");
      await expect(ver).toBeVisible();
      expect(await ver.getAttribute("href")).toBe("/buscar");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    });
  }

  test("/pedidos/novo a 390 px: botões de marca e de internet sem reticências nem corte", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const r = await page.goto("/pedidos/novo", { waitUntil: "domcontentloaded" });
    expect(r?.status() ?? 0).toBeLessThan(400);
    for (const nome of [/Mobiliado completo/, /300 Mbps/]) {
      const botao = page.getByRole("button", { name: nome }).first();
      await botao.scrollIntoViewIfNeeded();
      await expect(botao, `botão ${nome}`).toBeVisible();
      const m = await botao.evaluate((el) => {
        const filhos = [el as HTMLElement, ...Array.from(el.querySelectorAll<HTMLElement>("*"))];
        return {
          reticencias: filhos.some((n) => getComputedStyle(n).textOverflow === "ellipsis" && n.scrollWidth > n.clientWidth),
          cortado: filhos.some((n) => n.scrollHeight > n.clientHeight + 1 && getComputedStyle(n).overflow !== "visible"),
        };
      });
      expect(m.reticencias, `${nome}: texto cortado com reticências`).toBe(false);
      expect(m.cortado, `${nome}: texto cortado na altura`).toBe(false);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
});
