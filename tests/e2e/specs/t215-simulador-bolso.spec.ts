import { test, expect } from "@playwright/test";
import { calcularBolso } from "../../../src/lib/cobranca/bolso";
import { formatBRL } from "../../../src/lib/utils";

/**
 * T215 — "O que vai para o seu bolso" em /precos#simulador (ordem 6696611c, tela 10), a 390 e 1280 px.
 * Os números esperados saem da mesma função da tela (calcularBolso → comissaoSobreContrato).
 */
const limpo = (t: string | null) => (t ?? "").replace(/ /g, " ").replace(/\s+/g, " ").trim();

for (const [nome, largura] of [["390 px", 390], ["1280 px", 1280]] as const) {
  test.describe(`T215 — simulador do bolso a ${nome}`, () => {
    test.use({ viewport: { width: largura, height: 900 } });

    test("faixa 1–2: mostra recebe, taxa de 12% e o que fica; sem rolagem lateral", async ({ page }) => {
      await page.goto("/precos#simulador");
      const caixa = page.getByTestId("simulador-bolso");
      await expect(caixa).toBeVisible();
      const b = calcularBolso(3000, 6, 1);
      if (b.estado !== "ok") throw new Error("esperava estado ok");
      await expect(page.getByTestId("bolso-recebe")).toHaveText(new RegExp(limpoRe(formatBRL(b.recebe))));
      await expect(caixa).toContainText("Taxa Viva (12% do total)");
      await expect(page.getByTestId("bolso-taxa")).toHaveText(new RegExp(limpoRe(formatBRL(b.valorTaxa))));
      await expect(page.getByTestId("bolso-fica")).toHaveText(new RegExp(limpoRe(formatBRL(b.fica))));
      await expect(caixa).toContainText("A taxa só é cobrada com contrato fechado. Anúncio grátis.");
      const rolagem = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(rolagem).toBeLessThanOrEqual(1);
    });

    test("muda a faixa pela quantidade de imóveis e 31+ vira Plano Gestor", async ({ page }) => {
      await page.goto("/precos");
      const imoveis = page.getByTestId("bolso-imoveis");
      for (const [n, pct] of [["3", "10%"], ["6", "8%"], ["16", "6%"]] as const) {
        await imoveis.fill(n);
        await expect(page.getByTestId("simulador-bolso")).toContainText(`Taxa Viva (${pct} do total)`);
      }
      await imoveis.fill("31");
      await expect(page.getByTestId("bolso-gestor")).toContainText("fale com a Viva");
      await expect(page.getByTestId("bolso-taxa")).toHaveCount(0);
    });

    test("entrada inválida não mostra valores", async ({ page }) => {
      await page.goto("/precos");
      await page.getByTestId("bolso-valor").fill("0");
      await expect(page.getByTestId("bolso-resultado")).toHaveAttribute("data-estado", "invalido");
      await expect(page.getByTestId("bolso-recebe")).toHaveCount(0);
    });

    test("o texto público não usa 'comissão'", async ({ page }) => {
      await page.goto("/precos");
      expect(limpo(await page.getByTestId("simulador-bolso").textContent())).not.toMatch(/comiss|corretagem|intermedia/i);
    });
  });
}

function limpoRe(brl: string): string {
  return limpo(brl).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s");
}
