import { test, expect } from "@playwright/test";

/**
 * Rodada da vigia 24/10 (Pista C): confirmação do merge no lab-crítico do bloco 18 (t353).
 * T367 — E52 (3): em /parceiros/fotografos, "Buscar" com CEP e cidade vazios não recarrega a página — avisa "Digite a
 * cidade ou o CEP para buscar." e leva o foco ao CEP; digitar some o aviso; sem JavaScript (servidor), a URL vazia
 * mostra o mesmo aviso. Os estados vazios e o "Pedir credenciamento" não mudam. 390 e 1280 px, com prints.
 */
const SAIDA = "tests/laboratorio/saida";
const AVISO = "Digite a cidade ou o CEP para buscar.";

for (const w of [390, 1280]) {
  test.describe(`T367 — busca de fotógrafo vazia a ${w} px`, () => {
    test.use({ viewport: { width: w, height: w === 1280 ? 900 : 844 } });

    test("Buscar vazio avisa, foca o CEP e não navega; digitar some o aviso", async ({ page }) => {
      await page.goto("/parceiros/fotografos", { waitUntil: "domcontentloaded" });
      const busca = page.getByTestId("fotografos-busca");
      await expect(busca).toBeVisible();
      await expect(page.getByTestId("fotografos-busca-vazia")).toHaveCount(0);
      const url = page.url();
      await busca.getByRole("button", { name: "Buscar" }).click();
      const aviso = page.getByTestId("fotografos-busca-vazia");
      await expect(aviso).toHaveText(AVISO);
      await expect(aviso).toHaveAttribute("role", "alert");
      await expect(page.locator("#cep")).toBeFocused();
      await expect(page.locator("#cep")).toHaveAttribute("aria-invalid", "true");
      expect(page.url()).toBe(url);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await busca.screenshot({ path: `${SAIDA}/t367-busca-vazia-${w}.png` });
      await page.locator("#cep").fill("3");
      await expect(aviso).toHaveCount(0);
    });

    test("sem JavaScript (envio vazio pelo servidor) o mesmo aviso aparece", async ({ browser }) => {
      const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: w, height: 900 } });
      const p = await ctx.newPage();
      await p.goto("/parceiros/fotografos?cep=&cidade=", { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("fotografos-busca-vazia")).toHaveText(AVISO);
      await ctx.close();
    });
  });
}
