import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { COMISSAO_POR_PLANO, LIMITE_ANUNCIOS, PLANOS, REGRAS_CONTRATO, textoComissao } from "../../../src/config/planos";
import { resumoContrato } from "../../../src/lib/contrato-blocos";
import { simularRentabilidade } from "../../../src/lib/simulador";
import { formatBRL } from "../../../src/lib/utils";
import { FAIXAS_COMISSAO_PADRAO, comissaoSobreContrato, taxaPublicaTexto } from "../../../src/lib/cobranca/regra";

/**
 * T37 — SIMULADORES E NÚMEROS (laboratório e preview). Tudo o que a tela mostra
 * de dinheiro tem de bater com a fonte única `config/planos.ts`:
 *  1. Comissão 12 / 8 / 4 / 0 % por plano (Gratuito, Essencial, Profissional, Gestor).
 *  2. Limite de anúncios 1 / 5 / 20 / ilimitado e preços R$ 0 / 49 / 129.
 *  3. Caução: 50% de cada bloco, soma limitada a 3 aluguéis (cálculo puro).
 *  4. /precos: tabela de faixas (12 / 10 / 8 / 6% do valor total do contrato, Plano Gestor 31+),
 *     sem mensalidade; a marca ("imóveis mobiliados", "Caução") e a Viva sem tocar em dinheiro.
 *  5. Simulador do painel: a taxa de serviço de cada faixa é a da regra única (sem planos).
 */
const limpo = (t: string) => t.replace(/ /g, " ").replace(/\s+/g, " ");

test.describe("T37 — Números do código (fonte única)", () => {
  test("comissão 12 / 8 / 4 / 0 % e limite de anúncios 1 / 5 / 20 / ilimitado", () => {
    expect(COMISSAO_POR_PLANO).toEqual({ free: 0.12, essential: 0.08, pro: 0.04, gestor: 0 });
    expect(LIMITE_ANUNCIOS.free).toBe(1);
    expect(LIMITE_ANUNCIOS.essential).toBe(5);
    expect(LIMITE_ANUNCIOS.pro).toBe(20);
    expect(LIMITE_ANUNCIOS.gestor).toBeGreaterThanOrEqual(999);
    expect(PLANOS.map((p) => p.precoMensal)).toEqual([0, 49, 129, null]);
    expect(PLANOS.map((p) => p.assinaturaAnual)).toEqual([0, 588, 1548, null]);
  });

  test("comissão em reais = taxa da faixa × valor TOTAL do contrato (aluguel × meses), uma vez", () => {
    for (const aluguel of [1800, 2400, 3200, 7500]) {
      for (const p of PLANOS) {
        const r = resumoContrato(4, aluguel, p.comissao);
        expect(r.comissaoValor).toBe(Math.round(aluguel * 4 * p.comissao));
        expect(r.comissaoValor).toBeLessThanOrEqual(Math.round(aluguel * 4 * 0.12));
      }
    }
    // Exemplo: R$ 2.400 × 4 meses = R$ 9.600 → R$ 1.152 / 768 / 384 / 0.
    expect(PLANOS.map((p) => resumoContrato(4, 2400, p.comissao).comissaoValor)).toEqual([1152, 768, 384, 0]);
    expect(textoComissao(0.12, 2400)).toContain("12% do valor total do contrato");
    expect(textoComissao(0)).toContain("Taxa de serviço zero");
  });

  test("Caução: 50% de cada bloco e, no total, no máximo 3 aluguéis", () => {
    const aluguel = 3200;
    const dois = resumoContrato(2, aluguel, 0.08);
    expect(dois.caucaoTotal).toBe(aluguel * 2 * REGRAS_CONTRATO.caucaoFracaoBloco); // 3.200
    const quatro = resumoContrato(4, aluguel, 0.08);
    expect(quatro.blocos).toHaveLength(2);
    expect(quatro.caucaoTotal).toBe(6400);
    const seis = resumoContrato(6, aluguel, 0.08);
    expect(seis.caucaoTotal).toBeLessThanOrEqual(aluguel * REGRAS_CONTRATO.caucaoMaxAlugueis);
    for (const b of seis.blocos) expect(b.meses * 30).toBeLessThanOrEqual(REGRAS_CONTRATO.maxDiasBloco);
    // O desembolso do 1º bloco é aluguel do bloco + caução do bloco (a Viva não recebe nada disso).
    expect(quatro.desembolsoPrimeiroBloco).toBe(6400 + 3200);
  });
});

test.describe("T37 — /precos (visitante)", () => {
  test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 390, height: 844 } });

  // Regra vigente (ordens 75553f0a / 5df28a7b): sem cartões de plano com mensalidade; uma tabela de faixas
  // 12 / 10 / 8 / 6% sobre o valor TOTAL do contrato e o Plano Gestor a partir de 31 imóveis.
  // A 390 px a tabela some (hidden sm:table) e as mesmas faixas aparecem em cartões (t185).
  test("390 px: os cartões de faixa mostram a taxa e o exemplo em reais de cada faixa; sem mensalidade", async ({ page }) => {
    await page.goto("/precos", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("faixas-taxa")).toBeHidden();
    const cartoes = page.getByTestId("faixas-taxa-cartoes");
    await expect(cartoes).toBeVisible();
    const linhas = cartoes.locator(":scope > li");
    await expect(linhas).toHaveCount(FAIXAS_COMISSAO_PADRAO.length);
    for (const [i, f] of FAIXAS_COMISSAO_PADRAO.entries()) {
      const texto = limpo(await linhas.nth(i).innerText());
      expect(texto).toContain(limpo(taxaPublicaTexto(f)));
      if (f.gestor) expect(texto).toContain("Plano Gestor");
      else expect(texto).toContain(limpo(formatBRL(comissaoSobreContrato(3000, 3, f.taxa))));
    }
    // O Plano Gestor é um botão que abre a janela de contato (t185); não há mais bloco fixo na página.
    // O clique antes da hidratação não abre a janela: repete o toque até o formulário aparecer.
    await expect(async () => {
      await page.getByTestId("plano-gestor-botao").click();
      await expect(page.getByTestId("plano-gestor-form")).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    await expect(page.getByTestId("plano-gestor-form")).toContainText("31 imóveis ou mais");
    await page.keyboard.press("Escape");
    const corpo = limpo(await page.locator("body").innerText());
    expect(corpo).toContain("Sem mensalidade");
    expect(corpo).toMatch(/Caução/);
    expect(corpo).not.toMatch(/Grátis\s+R\$\s*0|Assinar Essencial|Assinar Profissional/);
    expect(corpo).not.toMatch(/apartamentos mobiliados/i);
    expect(corpo).not.toMatch(/aceito onde o Airbnb não é/i);
    await page.screenshot({ path: "tests/laboratorio/saida/t37-1-precos.png", fullPage: true });
  });
});

test.describe("T37 — /precos (visitante, 1280 px)", () => {
  test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1280, height: 800 } });

  test("a tabela de faixas mostra a taxa e o exemplo em reais de cada faixa", async ({ page }) => {
    await page.goto("/precos", { waitUntil: "domcontentloaded" });
    const tabela = page.getByTestId("faixas-taxa");
    await expect(tabela).toBeVisible();
    await expect(page.getByTestId("faixas-taxa-cartoes")).toBeHidden();
    const linhas = tabela.locator("tbody tr");
    await expect(linhas).toHaveCount(FAIXAS_COMISSAO_PADRAO.length);
    for (const [i, f] of FAIXAS_COMISSAO_PADRAO.entries()) {
      const texto = limpo(await linhas.nth(i).innerText());
      expect(texto).toContain(limpo(taxaPublicaTexto(f)));
      if (f.gestor) expect(texto).toContain("Plano Gestor");
      else expect(texto).toContain(limpo(formatBRL(comissaoSobreContrato(3000, 3, f.taxa))));
    }
  });
});

test.describe("T37 — Simulador do painel (proprietário)", () => {
  test.use({ storageState: authFile("proprietario"), viewport: { width: 390, height: 844 } });

  test("a taxa de serviço de cada faixa é a da regra única (aluguel R$ 3.000, 10 meses, 4 por contrato), sem planos", async ({ page }) => {
    await page.goto("/dashboard/simulador", { waitUntil: "networkidle" });
    const corpo = limpo(await page.locator("body").innerText());
    expect(corpo).not.toMatch(/Gratuito|Essencial|Profissional|Simular no plano|Assinatura \/ ano/);
    const entrada = { aluguelMensal: 3000, condoIptu: 550, contas: 350, mesesOcupados: 10, prazoMedioMeses: 4 };
    for (const f of FAIXAS_COMISSAO_PADRAO) {
      await page.locator("#imoveis-ativos").fill(String(f.minImoveis));
      await expect(page.getByTestId("imoveis-ativos")).toHaveText(String(f.minImoveis));
      await expect(page.getByTestId("taxa-faixa")).toHaveText(limpo(taxaPublicaTexto(f)));
      const esperado = simularRentabilidade(entrada, f.taxa, 0);
      const cartao = page.getByText(/^Taxa de serviço \(/).first().locator("xpath=..");
      await expect(cartao).toContainText(limpo(`− ${formatBRL(esperado.comissaoAnual)}`));
    }
    // Valores de referência: 12% de (3.000 × 4 meses) × 2,5 contratos = R$ 3.600; 6% = R$ 1.800.
    expect(simularRentabilidade(entrada, 0.12, 0).comissaoAnual).toBe(3600);
    expect(simularRentabilidade(entrada, 0.06, 0).comissaoAnual).toBe(1800);
    await page.screenshot({ path: "tests/laboratorio/saida/t37-2-simulador.png", fullPage: true });
  });
});
