import { test, expect } from "@playwright/test";

/*
  T2057 — E744 (Pista 3; autorizado pelo Gerente em 16/11) @E744 @ao-vivo-seguro
  Regra (E744/E756, regra única): o cartão lateral da página do imóvel diz o MESMO total que o cartão da busca — o
  "/mês" e o resumo da estadia ("R$ X em N meses"), também com 1 mês.
  Enquadramento do Gerente: se este spec apanhar defeitos, eles vão para a triagem da Fable, não são correção dela.
  Visitante, só leitura: os 6 primeiros cartões da /buscar.
*/
test.use({ storageState: { cookies: [], origins: [] } });
const limpo = (s: string) => s.replace(/[·\s]+/g, " ").trim();

test.describe("T2057 — E744: o total do cartão lateral = o do cartão da busca @E744 @ao-vivo-seguro", () => {
  test("para os 6 primeiros anúncios, /mês e resumo da estadia iguais na busca e na página", async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("card-resultado").first()).toBeVisible({ timeout: 30_000 });
    const amostra: { href: string; mes: string; estadia: string | null }[] = [];
    for (const c of (await page.getByTestId("card-resultado").all()).slice(0, 6)) {
      const href = await c.locator('a[href^="/imoveis/"]').first().getAttribute("href");
      const mes = limpo(await c.getByTestId("cartao-total-mes").first().innerText()).replace(/\/mês$/, "");
      const est = c.getByTestId("cartao-total-estadia");
      amostra.push({ href: href!, mes, estadia: (await est.count()) ? limpo(await est.first().innerText()) : null });
    }
    for (const a of amostra) {
      await page.goto(a.href, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("cartao-lateral-mes").first()).toBeVisible({ timeout: 30_000 });
      expect(limpo(await page.getByTestId("cartao-lateral-mes").first().innerText()), `${a.href}: /mês`).toBe(a.mes);
      if (a.estadia) expect(limpo(await page.getByTestId("cartao-lateral-estadia").first().innerText()), `${a.href}: resumo da estadia`).toBe(a.estadia);
    }
  });
});
