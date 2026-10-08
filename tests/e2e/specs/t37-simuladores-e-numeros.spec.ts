import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { COMISSAO_POR_PLANO, LIMITE_ANUNCIOS, PLANOS, REGRAS_CONTRATO, textoComissao } from "../../../src/config/planos";
import { resumoContrato } from "../../../src/lib/contrato-blocos";
import { simularRentabilidade } from "../../../src/lib/simulador";
import { formatBRL } from "../../../src/lib/utils";

/**
 * T37 — SIMULADORES E NÚMEROS (laboratório e preview). Tudo o que a tela mostra
 * de dinheiro tem de bater com a fonte única `config/planos.ts`:
 *  1. Comissão 12 / 8 / 4 / 0 % por plano (Gratuito, Essencial, Profissional, Gestor).
 *  2. Limite de anúncios 1 / 5 / 20 / ilimitado e preços R$ 0 / 49 / 129.
 *  3. Caução: 50% de cada bloco, soma limitada a 3 aluguéis (cálculo puro).
 *  4. /precos: cada cartão mostra preço, benefícios e o "O que você paga" do plano;
 *     a marca ("imóveis mobiliados", "Caução") e a Viva sem tocar em dinheiro.
 *  5. Simulador do painel: a comissão anual de cada plano é a do cálculo da config.
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

  test("comissão sempre em reais sobre UM aluguel, uma vez (nunca aluguel cheio)", () => {
    for (const aluguel of [1800, 2400, 3200, 7500]) {
      for (const p of PLANOS) {
        const r = resumoContrato(4, aluguel, p.comissao);
        expect(r.comissaoValor).toBe(Math.round(aluguel * p.comissao));
        expect(r.comissaoValor).toBeLessThanOrEqual(Math.round(aluguel * 0.12));
      }
    }
    // Exemplo da tela: R$ 2.400 → R$ 288 / 192 / 96 / 0.
    expect(PLANOS.map((p) => resumoContrato(4, 2400, p.comissao).comissaoValor)).toEqual([288, 192, 96, 0]);
    expect(textoComissao(0.12, 2400)).toContain("12% de um aluguel");
    expect(textoComissao(0)).toContain("Comissão zero");
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

  test("cada cartão mostra preço, benefícios e o custo do plano; marca e regras de texto", async ({ page }) => {
    await page.goto("/precos", { waitUntil: "networkidle" });
    for (const p of PLANOS) {
      const cartao = page.locator("div.rounded-3xl").filter({ has: page.getByRole("heading", { name: p.nome, exact: true }) });
      await expect(cartao).toHaveCount(1);
      const texto = limpo(await cartao.innerText());
      if (p.precoMensal === 0) expect(texto).toContain("Grátis");
      if (p.precoMensal) expect(texto).toContain(limpo(formatBRL(p.precoMensal)));
      for (const b of p.beneficios) expect(texto).toContain(limpo(b));
      expect(texto).toContain(limpo(p.custoLabel));
    }
    const corpo = limpo(await page.locator("body").innerText());
    expect(corpo).toMatch(/Caução/);
    expect(corpo).not.toMatch(/apartamentos mobiliados/i);
    expect(corpo).not.toMatch(/aceito onde o Airbnb não é/i);
    await page.screenshot({ path: "tests/laboratorio/saida/t37-1-precos.png", fullPage: true });
  });
});

test.describe("T37 — Simulador do painel (proprietário)", () => {
  test.use({ storageState: authFile("proprietario"), viewport: { width: 390, height: 844 } });

  test("a comissão anual de cada plano é a do cálculo da config (aluguel R$ 3.000, 10 meses, 4 por contrato)", async ({ page }) => {
    await page.goto("/dashboard/simulador", { waitUntil: "networkidle" });
    const entrada = { aluguelMensal: 3000, condoIptu: 550, contas: 350, mesesOcupados: 10, prazoMedioMeses: 4 };
    for (const p of PLANOS) {
      await page.getByRole("button", { name: p.nome, exact: true }).click();
      const esperado = simularRentabilidade(entrada, p.comissao, p.assinaturaAnual ?? 0);
      const cartao = page.getByText(/^Comissão Viva \(/).locator("xpath=..");
      await expect(cartao).toContainText(limpo(textoComissao(p.comissao)));
      await expect(cartao).toContainText(limpo(`− ${formatBRL(esperado.comissaoAnual)}`));
    }
    // Valores de referência: Gratuito 12% de 3.000 × 2,5 contratos = R$ 900; Gestor = R$ 0.
    expect(simularRentabilidade(entrada, 0.12, 0).comissaoAnual).toBe(900);
    expect(simularRentabilidade(entrada, 0, 0).comissaoAnual).toBe(0);
    await page.screenshot({ path: "tests/laboratorio/saida/t37-2-simulador.png", fullPage: true });
  });
});
