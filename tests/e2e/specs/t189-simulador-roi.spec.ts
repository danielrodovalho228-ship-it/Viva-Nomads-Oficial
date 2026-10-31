import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { baseMobiliadoAno, simularROI } from "../../../src/lib/simulador";
import { formatBRL } from "../../../src/lib/utils";

/*
  T189 — Simulador de rentabilidade e Calculadora de ROI (prompt 15), a 390 e 1280 px, como proprietário.
  1. Simulador: condomínio e contas "Cobrado à parte" por padrão; trocar para "Incluído" muda a líquida para a conta
     da base única; valor do imóvel mostra a rentabilidade; cenários (3 linhas), gráfico e "Como calculamos".
  2. ROI: contrato tradicional com padrões editáveis; ponto de equilíbrio (valor e ocupação); cenários, gráfico,
     "Como calculamos"; a líquida do mobiliado é a MESMA do simulador com as mesmas entradas.
  3. Sem número de mercado sem fonte nos painéis de destaque; sem rolagem lateral.
  E294: os dois viraram um cálculo só (/dashboard/simulador), só com os números do dono — tudo começa vazio e o
  tradicional entra só com o valor mensal dele digitado. /dashboard/roi-imovel leva para o simulador.
*/
const SAIDA = "tests/laboratorio/saida";
const limpo = (t: string) => t.replace(/ /g, " ").replace(/\s+/g, " ");

/** Digita no campo pelo rótulo (R$ em texto brasileiro; os outros numéricos). */
async function digitar(page: Page, rotulo: string, valor: number) {
  const esc = rotulo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nome = new RegExp(`^${esc}( R\\$)?$`);
  await page.getByRole("spinbutton", { name: nome }).or(page.getByRole("textbox", { name: nome })).fill(String(valor));
}

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

test.describe("T189 — simulador e ROI (prompt 15)", () => {
  test.skip(!hasAccount("proprietario"), "conta de proprietário do laboratório não configurada");
  test.use({ storageState: authFile("proprietario") });

  for (const largura of [390, 1280]) {
    test(`${largura}px — simulador: cobrado à parte, rentabilidade, cenários e Como calculamos`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/dashboard/simulador", { waitUntil: "networkidle" });
      const corpo = limpo(await page.locator("main").innerText());
      expect(corpo).not.toMatch(/2\.800–3\.400|~10 meses\/ano/);

      // E294: começa vazio — nenhuma conta sem os números do dono.
      await expect(page.getByTestId("sim-vazio")).toBeVisible();
      await expect(page.getByTestId("sim-liquida")).toHaveCount(0);
      await digitar(page, "Valor mensal pretendido", 3000);
      await digitar(page, "Condomínio + IPTU (mês)", 550);
      await digitar(page, "Contas de consumo — água, luz, internet (mês)", 350);
      await digitar(page, "Meses ocupados no ano (1 a 12)", 10);

      // Padrão: cobrado à parte nos dois.
      for (const id of ["cobranca-condo", "cobranca-contas"]) {
        await expect(page.getByTestId(id).getByRole("radio", { name: "Cobrado à parte" })).toHaveAttribute("aria-checked", "true");
      }
      const base = { valorMensal: 3000, condoIptu: 550, contas: 350, mesesOcupados: 10 };
      const liquida = page.getByTestId("sim-liquida");
      await expect(liquida).toContainText(limpo(formatBRL(baseMobiliadoAno(base, 0.12).liquidaAnual)));

      // Condomínio incluído no valor mensal: o proprietário paga os 12 meses.
      await page.getByTestId("cobranca-condo").getByRole("radio", { name: "Incluído no valor mensal" }).click();
      await expect(liquida).toContainText(limpo(formatBRL(baseMobiliadoAno({ ...base, condoCobranca: "incluido" }, 0.12).liquidaAnual)));
      await page.getByTestId("cobranca-condo").getByRole("radio", { name: "Cobrado à parte" }).click();

      // Valor do imóvel → rentabilidade sobre o imóvel.
      await expect(page.getByTestId("sim-rentabilidade-imovel")).toHaveCount(0);
      await page.getByLabel("Valor do imóvel (opcional)").fill("500000");
      const pct = (baseMobiliadoAno(base, 0.12).liquidaAnual / 500000) * 100;
      await expect(page.getByTestId("sim-rentabilidade-imovel")).toContainText(`${pct.toFixed(1).replace(".", ",")}% ao ano`);

      // Cenários: 8 / 10 / 12 meses.
      const linhas = page.getByTestId("sim-cenarios").locator("tbody tr");
      await expect(linhas).toHaveCount(3);
      await expect(linhas.nth(0)).toContainText("Conservador");
      await expect(linhas.nth(2)).toContainText(limpo(formatBRL(baseMobiliadoAno({ ...base, mesesOcupados: 12 }, 0.12).liquidaAnual)));
      await expect(page.getByTestId("sim-grafico")).toContainText("Para onde vai a receita do ano");

      const como = page.getByTestId("sim-como-calculamos");
      await como.locator("summary").click();
      await expect(como).toContainText("nunca incide sobre condomínio, IPTU ou contas cobrados à parte");
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t189-simulador-${largura}.png`, fullPage: true });
    });

    test(`${largura}px — ROI no mesmo cálculo: tradicional digitado, ponto de equilíbrio e cenários`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/dashboard/roi-imovel", { waitUntil: "networkidle" });
      // E294: o endereço antigo leva ao simulador (um cálculo só).
      await expect(page).toHaveURL(/\/dashboard\/simulador$/);
      const corpo = limpo(await page.locator("main").innerText());
      expect(corpo).not.toMatch(/\+40–70%|2–4 anos/);
      await digitar(page, "Valor mensal pretendido", 3000);
      await digitar(page, "Contas de consumo — água, luz, internet (mês)", 400);
      await digitar(page, "Meses ocupados no ano (1 a 12)", 10);
      await digitar(page, "Investimento na mobília", 25000);
      await digitar(page, "Reposição e desgaste da mobília (% do investimento por ano)", 10);
      await expect(page.getByTestId("roi-sem-tradicional")).toBeVisible();
      await digitar(page, "Valor mensal do tradicional (sem mobília)", 1800);
      await digitar(page, "Meses vazios por ano", 1);
      await digitar(page, "Taxa de administração (%)", 10);
      await digitar(page, "Taxa de contrato: 1 valor mensal a cada (meses)", 30);

      const entrada = {
        investimentoMobiliar: 25000,
        aluguelVazio: 1800,
        aluguelMobiliado: 3000,
        mesesOcupados: 10,
        prazoMedioMeses: 4,
        contasMensais: 400,
        reposicaoAnualPct: 0.1,
        condoIptu: 0,
      };
      const r = simularROI(entrada, 0.12, 0);
      await expect(page.getByTestId("roi-liquidos")).toContainText(limpo(formatBRL(r.netMobiliadoAnual)));
      await expect(page.getByTestId("roi-liquidos")).toContainText(limpo(formatBRL(r.netVazioAnual)));
      // Mesma base do simulador: líquido do mobiliado = base − reposição.
      expect(r.netMobiliadoAnual).toBe(baseMobiliadoAno({ valorMensal: 3000, condoIptu: 0, contas: 400, mesesOcupados: 10 }, 0.12).liquidaAnual - 2500);

      await expect(page.getByTestId("roi-tradicional")).toContainText("Digite os números do contrato tradicional");
      await expect(page.getByTestId("roi-equilibrio-valor")).toContainText(limpo(formatBRL(r.valorMinimoEmpate!)));
      await expect(page.getByTestId("roi-equilibrio-ocupacao")).toContainText(`${r.ocupacaoMinimaEmpate} meses por ano`);

      // Aplicação só aparece com rendimento informado.
      await expect(page.getByTestId("roi-aplicacao")).toHaveCount(0);
      await page.getByLabel(/Rendimento anual se o investimento ficasse aplicado/).fill("10");
      await expect(page.getByTestId("roi-aplicacao")).toBeVisible();

      await expect(page.getByTestId("sim-cenarios").locator("tbody tr")).toHaveCount(3);
      await expect(page.getByTestId("roi-grafico")).toContainText("mobiliado × tradicional");
      const como = page.getByTestId("sim-como-calculamos");
      await como.locator("summary").click();
      await expect(como).toContainText("Tudo sai dos números que você digitou");
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t189-roi-${largura}.png`, fullPage: true });
    });
  }
});
