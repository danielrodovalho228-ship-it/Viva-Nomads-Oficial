import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T68 — ordem c54366b0 (complemento da b3c9d76e): a comissão incide sobre o VALOR
 * TOTAL do contrato (aluguel × meses). Páginas públicas e ferramentas do proprietário
 * não falam mais em "primeiro mês" / "1 aluguel".
 */
test.describe("T68 — Comissão sobre o valor total: páginas públicas", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("/precos, /termos, /para-proprietarios e home: valor total, nunca primeiro mês", async ({ page }) => {
    for (const rota of ["/precos", "/termos", "/para-proprietarios", "/"]) {
      await page.goto(rota, { waitUntil: "networkidle" });
      const texto = await page.locator("main").innerText();
      expect(texto, rota).toMatch(/valor total (do|de cada) contrato/i);
      expect(texto, rota).not.toMatch(/(comissão|taxa)[^.]{0,60}(primeiro (mês|aluguel)|1º (mês|aluguel)|de um aluguel)/i);
    }
  });
});

test.describe("T68 — Comissão sobre o valor total: ferramentas do proprietário", () => {
  test.use({ storageState: authFile("proprietario") });

  test("/dashboard/simulador e /dashboard/roi-imovel: % do valor total do contrato", async ({ page }) => {
    await page.goto("/dashboard/simulador", { waitUntil: "networkidle" });
    let texto = await page.locator("main").innerText();
    expect(texto).toMatch(/do valor total/i);
    expect(texto).not.toMatch(/de 1 aluguel|de um aluguel|1º aluguel/i);
    await page.goto("/dashboard/roi-imovel", { waitUntil: "networkidle" });
    texto = await page.locator("main").innerText();
    expect(texto).toMatch(/valor total do contrato/i);
    expect(texto).not.toMatch(/primeiro mês/i);
  });
});
