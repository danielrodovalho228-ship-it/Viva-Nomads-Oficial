import { test, expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";

/*
  T200 — Páginas dos sócios /roi e /simulacao (prompt 21), a 390 e 1280 px, com o código dos sócios:
  1. Frase do topo, 4 cartões (pior caixa, 1º mês positivo, payback, ROI 36m com 12m e 24m) e os 3 gráficos.
  2. "Ligar todas" muda o payback; "Só as sem pendência jurídica" deixa verificação e fundadores desligados.
  3. Comparação "Só taxa × Taxa + extras" (guardada em JSON para o relatório), sem rolagem lateral, PDF gerado.
*/
const SAIDA = "tests/laboratorio/saida";
const limpo = (t: string) => t.replace(/ /g, " ").replace(/\s+/g, " ").trim();

async function entrarComoSocio(page: Page, rota: string) {
  const codigo = process.env.SOCIOS_ACCESS_CODE;
  test.skip(!codigo, "SOCIOS_ACCESS_CODE não definido neste ambiente");
  await page.goto(`/acesso-socios?next=${encodeURIComponent(rota)}`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="codigo"]').fill(codigo!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(new RegExp(`${rota}$`));
}

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

async function comparativo(page: Page) {
  return page.getByTestId("comparativo-extras").locator("tbody tr").evaluateAll((trs) =>
    trs.map((tr) => Array.from(tr.querySelectorAll("td")).map((td) => (td.textContent ?? "").replace(/ /g, " ").trim()))
  );
}

test.describe("T200 — /roi e /simulacao dos sócios (prompt 21)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const largura of [390, 1280]) {
    test(`${largura}px — /roi: frase, cartões, gráficos, Ligar todas, Só sem pendência, PDF`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width: largura, height: 900 });
      await entrarComoSocio(page, "/roi");

      // 1. Tudo desligado: frase só da taxa, 4 cartões, 3 gráficos com tabela para leitor de tela.
      const frase = page.getByTestId("roi-frase");
      await expect(frase).toContainText("Cenário Base, só com a taxa de serviço");
      const cartoes = page.getByTestId("roi-cartoes").locator(":scope > div");
      await expect(cartoes).toHaveCount(4);
      await expect(page.getByTestId("roi-36")).toContainText(/12 meses: .*24 meses: /);
      for (const g of ["grafico-fontes", "grafico-caixa", "grafico-contrato"]) {
        await expect(page.getByTestId(g)).toBeVisible();
        await expect(page.getByTestId(g).locator("table.sr-only")).toHaveCount(1);
      }
      await expect(page.getByTestId("grafico-fontes").locator("svg rect").first()).toBeAttached();
      for (const id of ["verificacao_inquilino", "b2b_alocacao", "publicamos_pago", "ferramentas_fora", "fundadores"]) {
        await expect(page.getByTestId(`receita-${id}`)).toHaveAttribute("data-ligada", "0");
      }
      await expect(page.getByTestId("rodape-socios")).toContainText("Estimativa para decidir, não é parecer contábil");
      const corpo = limpo(await page.locator("body").innerText());
      expect(corpo).not.toMatch(/comiss[ãa]o/i);
      const paybackDesligado = limpo(await page.getByTestId("roi-payback").innerText());
      const tabelaDesligado = await comparativo(page);
      expect(tabelaDesligado.map((l) => l[1])).toEqual(tabelaDesligado.map((l) => l[2])); // nada ligado: colunas iguais
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t200-roi-desligado-${largura}.png`, fullPage: true });

      // 2. Ligar todas: muda o payback e a frase compara as duas contas.
      await page.getByTestId("receitas-ligar-todas").click();
      await expect(frase).toContainText("receitas adicionais ligadas (potencial)");
      await expect(page.getByTestId("roi-payback")).not.toHaveText(paybackDesligado);
      for (const id of ["verificacao_inquilino", "fundadores"]) await expect(page.getByTestId(`receita-${id}`)).toHaveAttribute("data-ligada", "1");
      await expect(page.getByTestId("grafico-fontes").getByText("Desconto fundadores")).toBeVisible();
      await expect(page.getByTestId("receita-fundadores")).toContainText("aguarda parecer jurídico");
      const tabelaLigado = await comparativo(page);
      expect(tabelaLigado[3][2]).not.toBe(tabelaLigado[3][1]); // receita por contrato sobe
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t200-roi-ligado-${largura}.png`, fullPage: true });

      // 3. Só as sem pendência jurídica: verificação e fundadores ficam desligados; o resto ligado.
      await page.getByTestId("receitas-sem-pendencia").click();
      await expect(page.getByTestId("receita-verificacao_inquilino")).toHaveAttribute("data-ligada", "0");
      await expect(page.getByTestId("receita-fundadores")).toHaveAttribute("data-ligada", "0");
      for (const id of ["b2b_alocacao", "publicamos_pago", "ferramentas_fora", "seguro_fianca"]) {
        await expect(page.getByTestId(`receita-${id}`)).toHaveAttribute("data-ligada", "1");
      }
      const tabelaSemPendencia = await comparativo(page);
      await semRolagemLateral(page);

      // Duração do contrato editável: muda a receita por contrato.
      await page.getByTestId("receitas-desligar-todas").click();
      const antes = limpo(await page.getByTestId("comparativo-extras").locator("tbody tr").nth(3).innerText());
      await page.getByTestId("meses-contrato").fill("6");
      await expect(page.getByTestId("comparativo-extras").locator("tbody tr").nth(3)).not.toHaveText(antes);

      // 4. PDF (impressão): frase, cartões, comparação e gráficos entram.
      await page.getByTestId("receitas-ligar-todas").click();
      await page.emulateMedia({ media: "print" });
      for (const id of ["roi-frase", "roi-cartoes", "comparativo-extras", "graficos-roi"]) await expect(page.getByTestId(id)).toBeVisible();
      await expect(page.getByTestId("receitas-ligar-todas")).toBeHidden();
      const pdf = await page.pdf({ format: "A4", printBackground: true });
      expect(pdf.length).toBeGreaterThan(20_000);
      writeFileSync(`${SAIDA}/t200-roi-${largura}.pdf`, pdf);
      await page.emulateMedia({ media: "screen" });

      if (largura === 1280) {
        writeFileSync(`${SAIDA}/t200-comparativo-base.json`, JSON.stringify({ desligado: tabelaDesligado, ligarTodas: tabelaLigado, semPendencia: tabelaSemPendencia }, null, 2));
      }
    });
  }

  test("390px — /simulacao: mesma frase, cartões e painel de receitas adicionais", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await entrarComoSocio(page, "/simulacao");
    await expect(page.getByTestId("roi-frase")).toContainText("só com a taxa de serviço");
    await expect(page.getByTestId("roi-cartoes").locator(":scope > div")).toHaveCount(4);
    for (const g of ["seguros", "servicos", "produtos"]) await expect(page.getByTestId(`grupo-${g}`)).toBeVisible();
    await semRolagemLateral(page);
  });
});
