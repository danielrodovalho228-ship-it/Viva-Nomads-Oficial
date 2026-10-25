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

    test("3.000 × 4: dois fatos separados — recebe integral e a taxa à parte, sem linha de resultado (E51); sem rolagem lateral", async ({ page }) => {
      await page.goto("/precos#simulador");
      const caixa = page.getByTestId("simulador-bolso");
      await expect(caixa).toBeVisible();
      await page.getByTestId("bolso-valor").fill("3000");
      await page.getByTestId("bolso-meses").fill("4");
      await page.getByTestId("bolso-imoveis").fill("1");
      const b = calcularBolso(3000, 4, 1);
      if (b.estado !== "ok") throw new Error("esperava estado ok");
      // E51: 12.000 e 1.440 como fatos separados — nenhuma conta "recebe − taxa" na tela.
      await expect(page.getByTestId("bolso-recebe")).toHaveText(new RegExp(limpoRe(formatBRL(12000))));
      await expect(page.getByTestId("bolso-recebe-detalhe")).toHaveText("integral e direto a você");
      await expect(caixa).toContainText("Taxa de serviço da Viva");
      await expect(page.getByTestId("bolso-taxa")).toHaveText(new RegExp(`^${limpoRe(formatBRL(1440))}$`));
      await expect(page.getByTestId("bolso-taxa-detalhe")).toHaveText("12% sobre o valor mensal × meses (R$ 3.000 × 4). Cobrada à parte, só com contrato fechado");
      await expect(caixa).not.toContainText(/resultado/i);
      await expect(caixa).not.toContainText("10.560");
      await expect(page.getByTestId("bolso-seu-resultado")).toHaveCount(0);
      await expect(caixa.locator("dl")).toHaveCount(2);
      await expect(caixa).toContainText("A taxa só é cobrada com contrato fechado. Anúncio grátis.");
      const rolagem = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(rolagem).toBeLessThanOrEqual(1);
      await caixa.screenshot({ path: `tests/laboratorio/saida/t215-${process.env.T215_FASE ?? "depois"}-bolso-${largura}.png` });
    });

    test("muda a faixa pela quantidade de imóveis e 31+ vira Plano Gestor", async ({ page }) => {
      await page.goto("/precos");
      const imoveis = page.getByTestId("bolso-imoveis");
      for (const [n, pct] of [["3", "10%"], ["6", "8%"], ["16", "6%"]] as const) {
        await imoveis.fill(n);
        await expect(page.getByTestId("bolso-taxa-detalhe")).toContainText(`${pct} sobre o valor mensal × meses`);
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

    test("o texto público não usa 'comissão' nem termos de custódia; a taxa nunca aparece com sinal de menos", async ({ page }) => {
      await page.goto("/precos");
      const texto = limpo(await page.getByTestId("simulador-bolso").textContent());
      expect(texto).not.toMatch(/comiss|corretagem|intermedia/i);
      // Guarda de custódia (adendo do #851): a Viva só intermedia, não segura pagamentos.
      expect(texto).not.toMatch(/fica com você|descontad|retid|repass|do total/i);
      expect(limpo(await page.getByTestId("bolso-taxa").textContent())).not.toMatch(/^[-−–]/);
    });
  });
}

function limpoRe(brl: string): string {
  return limpo(brl).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s");
}
