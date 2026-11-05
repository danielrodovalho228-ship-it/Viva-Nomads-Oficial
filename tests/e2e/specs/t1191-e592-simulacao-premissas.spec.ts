import { test, expect, type Page } from "@playwright/test";

/*
  T1191 — E592/E594 (Frente B): a /simulacao dos sócios projeta com o modelo validado — aluguel médio de R$ 3.000 e taxa
  média de 10% — e mostra as lacunas de custo (o que ainda não tem preço) num quadro próprio. 390 e 1280 px, com o código
  dos sócios. Só leitura: nenhuma escrita, nenhuma chave alterada.
*/
const limpo = (t: string) => t.replace(/ /g, " ").replace(/\s+/g, " ").trim();

async function entrarComoSocio(page: Page, rota: string) {
  const codigo = process.env.SOCIOS_ACCESS_CODE;
  test.skip(!codigo, "SOCIOS_ACCESS_CODE não definido neste ambiente");
  await page.goto(`/acesso-socios?next=${encodeURIComponent(rota)}`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="codigo"]').fill(codigo!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(new RegExp(`${rota}$`));
}

test.describe("T1191 — E592/E594: /simulacao com o modelo validado e as lacunas de custo", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const largura of [390, 1280]) {
    test(`${largura}px — modelo v3: R$ 3.000 × 3 meses na faixa da carteira, regime Presumido em destaque e o quadro das lacunas`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width: largura, height: 900 });
      await entrarComoSocio(page, "/simulacao");

      const corpo = limpo(await page.locator("body").innerText());
      // Receita do modelo validado (o texto do "Como calculamos" lê a mesma fonte da conta).
      expect(corpo).toMatch(/aluguel médio de R\$ 3\.000/);
      // Modelo v3 (05/11): a taxa é a da faixa da carteira (padrão 10%), nunca 12% fixo; a projeção antiga saiu.
      expect(corpo).toMatch(/A conta usa a faixa escolhida \(agora 10%/);
      expect(corpo).not.toMatch(/R\$ 4\.320/);
      expect(corpo).not.toMatch(/69,3 mil|se paga no mês 27/);
      await expect(page.getByTestId("regime-presumido")).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByTestId("seletor-regime")).toContainText("instrumento societário em revisão");
      await expect(page.getByTestId("faixa-10")).toHaveAttribute("aria-pressed", "true");
      for (const f of ["12", "10", "8", "6", "4"]) await expect(page.getByTestId(`faixa-${f}`)).toBeVisible();
      // E623: a faixa do Gestor (estrutura de 04/11/2026) aparece com o que ela traz.
      await expect(page.getByTestId("faixa-4")).toContainText("Gestor: 20+ imóveis ou administradora");
      await expect(page.getByTestId("faixa-gestor-detalhe")).toContainText("cadastro assistido e contato direto");
      // E622: o rótulo do equilíbrio e o KPI usam o mesmo custo fixo (com os encargos do regime): 12 no Presumido.
      await expect(page.getByTestId("equilibrio-fixo")).toContainText("12 contratos por mês");
      expect(corpo).toMatch(/Stays \(channel manager\): só na fase 2 do Gestor/);
      expect(corpo).toMatch(/a Viva não tem hoje/);
      expect(corpo).not.toMatch(/Taxa média ponderada/);

      // Lacunas de custo: o quadro existe e lista o que ainda não tem preço.
      const lacunas = page.getByTestId("lacunas-custo");
      await expect(lacunas).toBeVisible();
      await expect(lacunas).toContainText("Custos ainda sem valor / opcionais (não somados)");
      // Veredito do coordenador (05/11): CDL e e-mail visíveis, fora da soma.
      await expect(lacunas).toContainText("Associação à CDL Uberlândia, ~R$ 100/mês, sugestão da Dra. Beatriz, decisão pendente");
      await expect(lacunas).toContainText("Hostinger");
      await expect(page.getByTestId("opcional-nao-somado")).toHaveCount(2);
      // P3 (05/11): contrato do investidor e 5 modelos de contrato a cotar, fora da soma.
      await expect(page.getByTestId("a-cotar-nao-somado")).toHaveCount(2);
      await expect(lacunas).toContainText("Contrato do investidor");
      await expect(lacunas).toContainText("5 modelos de contrato");
      for (const item of ["Emissor de NFS-e", "Alvará de funcionamento", "Antifraude", "Identidade", "WhatsApp"]) {
        await expect(lacunas, item).toContainText(item);
      }
      await expect(lacunas).toContainText(/hipótese/);

      // Sem rolagem lateral no celular nem no computador.
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await lacunas.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `tests/laboratorio/saida/t1191-simulacao-lacunas-${largura}.png` });
    });
  }
});
