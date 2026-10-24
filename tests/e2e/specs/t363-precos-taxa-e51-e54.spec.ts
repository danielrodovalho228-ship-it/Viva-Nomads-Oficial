import { test, expect } from "@playwright/test";

/**
 * T363 — /precos (auditoria de textos × lei do produto, 23/10):
 *   E51. "O que vai para o seu bolso": a taxa NUNCA aparece como dedução do que o morador paga. Dois fatos separados
 *        ("Você recebe do morador: R$ 12.000, integral e direto" e "Taxa de serviço da Viva: R$ 1.440, cobrada à parte,
 *        só com contrato fechado"), sem linha de resultado subtraída; valores e faixas mantidos.
 *   E54. "Compare": a linha do Airbnb separa anfitrião × quem viaja como o artigo 1857 (taxa única de 16% do anfitrião no
 *        Brasil; na estrutura dividida, 4% do anfitrião e 14,1% a 16,5% do viajante), com a fonte e a data.
 * Prints do bloco e da tabela a 390 e 1280 (FASE=antes|depois).
 */
const SAIDA = "tests/laboratorio/saida";
const FASE = process.env.T363_FASE ?? "depois";

for (const w of [1280, 390]) {
  test.describe(`T363 — /precos a ${w} px`, () => {
    test.use({ viewport: { width: w, height: 900 } });

    test(`prints (${FASE}): bolso e Compare`, async ({ page }) => {
      await page.goto("/precos", { waitUntil: "domcontentloaded" });
      const bolso = page.getByTestId("simulador-bolso");
      await bolso.scrollIntoViewIfNeeded();
      await page.getByTestId("bolso-valor").fill("3000");
      await page.getByTestId("bolso-meses").fill("4");
      await page.getByTestId("bolso-imoveis").fill("1");
      await expect(page.getByTestId("bolso-taxa")).toContainText("1.440");
      await bolso.screenshot({ path: `${SAIDA}/t363-${FASE}-bolso-${w}.png` });
      const compare = page.locator("#compare");
      await compare.scrollIntoViewIfNeeded();
      await compare.screenshot({ path: `${SAIDA}/t363-${FASE}-compare-${w}.png` });
    });

    test("E51 e E54: textos", async ({ page }) => {
      test.skip(FASE === "antes", "Na fase 'antes' só os prints.");
      await page.goto("/precos", { waitUntil: "domcontentloaded" });
      await page.getByTestId("bolso-valor").fill("3000");
      await page.getByTestId("bolso-meses").fill("4");
      await page.getByTestId("bolso-imoveis").fill("1");
      const bolso = page.getByTestId("simulador-bolso");
      await expect(page.getByTestId("bolso-recebe")).toContainText("12.000");
      await expect(page.getByTestId("bolso-recebe-detalhe")).toHaveText("integral e direto a você");
      await expect(page.getByTestId("bolso-taxa")).toContainText("1.440");
      await expect(page.getByTestId("bolso-taxa-detalhe")).toContainText("Cobrada à parte, só com contrato fechado");
      // Nenhuma conta "recebe − taxa": sem "resultado", sem 10.560, sem sinal de menos antes de R$.
      await expect(bolso).not.toContainText(/resultado/i);
      await expect(bolso).not.toContainText("10.560");
      expect(await bolso.innerText()).not.toMatch(/[−–-]\s*R\$/);
      // Faixas mantidas: 3 imóveis → 10%.
      await page.getByTestId("bolso-imoveis").fill("3");
      await expect(page.getByTestId("bolso-taxa-detalhe")).toContainText("10% sobre o valor mensal × meses");

      const airbnb = page.locator('#compare [data-compare="airbnb"]');
      await expect(airbnb).toContainText("Anfitrião no Brasil: taxa única de 16% sobre a estadia.");
      await expect(airbnb).toContainText("o anfitrião paga 4% e o viajante paga de 14,1% a 16,5%");
      await expect(airbnb).not.toContainText("16% sobre cada estadia para anfitriões");
      await expect(airbnb.getByRole("link", { name: /artigo 1857/ })).toHaveAttribute("href", "https://www.airbnb.com.br/help/article/1857");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    });
  });
}
