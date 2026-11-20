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
    test(`${largura}px — modelo v3: R$ 3.000 × 3 meses na faixa da carteira, Simples como padrão (Presumido alternativo) e o quadro das lacunas`, async ({ page }) => {
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
      // E622 (veredito de 05/11): Simples é o padrão; o Presumido é o cenário alternativo, em definição.
      await expect(page.getByTestId("regime-simples")).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByTestId("regime-presumido")).toContainText("Lucro Presumido · 16,3% (cenário alternativo · regime em definição)");
      await expect(page.getByTestId("seletor-regime")).toContainText("instrumento societário em revisão");
      await expect(page.getByTestId("regime-presumido-iss5")).toHaveCount(0);
      await expect(page.getByRole("group", { name: "Operador local" })).toHaveCount(0); // sem operador pago desde 18/10
      await expect(page.getByTestId("faixa-10")).toHaveAttribute("aria-pressed", "true");
      for (const f of ["12", "10", "8", "6", "4"]) await expect(page.getByTestId(`faixa-${f}`)).toBeVisible();
      // E623: a faixa do Gestor (estrutura de 04/11/2026) aparece com o que ela traz.
      await expect(page.getByTestId("faixa-4")).toContainText("Gestor: 20+ imóveis ou administradora");
      await expect(page.getByTestId("faixa-gestor-detalhe")).toContainText("cadastro assistido e contato direto");
      // E622: equilíbrio 10 no Simples (padrão) e 13 no Presumido (16,33% + INSS de R$ 1.200, a confirmar com o Rodolfo).
      await expect(page.getByTestId("equilibrio-fixo")).toContainText("10 contratos por mês");
      await page.getByTestId("regime-presumido").click();
      await expect(page.getByTestId("equilibrio-fixo")).toContainText("13 contratos por mês");
      await expect(page.getByTestId("regime-detalhe")).toContainText("a confirmar com o Rodolfo");
      await expect(page.getByTestId("regime-detalhe")).toContainText("R$ 1.200/mês");
      await page.getByTestId("regime-simples").click();
      expect(corpo).toMatch(/Stays \(channel manager\): só na fase 2 do Gestor/);
      expect(corpo).toMatch(/a Viva não tem hoje/);
      expect(corpo).not.toMatch(/Taxa média ponderada/);

      // Lacunas de custo: o quadro existe e lista o que ainda não tem preço.
      const lacunas = page.getByTestId("lacunas-custo");
      await expect(lacunas).toBeVisible();
      await expect(lacunas).toContainText("Custos ainda sem valor / opcionais (não somados)");
      // Veredito do coordenador (05/11): ACIUB e e-mail visíveis, fora da soma.
      await expect(lacunas).toContainText("Associação à ACIUB Uberlândia, ~R$ 100/mês, sugestão da Dra. Beatriz, decisão pendente");
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
