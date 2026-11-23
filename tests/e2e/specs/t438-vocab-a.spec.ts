// ORDEM-DUET-534 (Gerente, 22/11/2026): a última faixa PUBLICADA passa de "16 ou mais" / "16+" a "16–19" (a partir de 20, a linha de carteiras, sem percentual). As asserções deste arquivo que cobravam "16 ou mais" foram ajustadas por essa decisão; o cálculo não mudou.
import { test, expect } from "@playwright/test";
import { TEXTO_CARTEIRAS } from "../../../src/config/planos";
import { achadosProibidos } from "../../../src/lib/frases-proibidas";

/**
 * T438 — VOCAB-A: o que o visitante lê usa o vocabulário da casa.
 *  1. /seguranca: "Morar com segurança na Viva Nomads", "morador" e nada de "inquilino", "aluguel" ou "comissão".
 *  2. /para-proprietarios: a cobrança da Viva se chama "taxa de serviço", com os números da regra (12% a 6%).
 *  3. Páginas públicas (home, /como-funciona, /empresas, /guias): nenhum "inquilino" nem "comissão" no texto da tela.
 *  4. /ajuda: a resposta de "Esqueci minha senha" começa por "Você não precisa de senha".
 *  Em 390 e 1280 px, com prints.
 * Rodadas fora do lab completo (teto L-5): 30/10, sobre a main com #1553–#1556, no lab-crítico do #1558 (bloco 67).
 * Asserções alteradas pelo prompt 078 (Daniel, 16/11/2026): caso 2 — a escada de /para-proprietarios termina em
 * "16–19 imóveis: 6%" e é seguida da linha de carteiras, não mais de "Plano Gestor: {GESTOR_TEXTO}".
 */
const PROIBIDAS = /\binquilin[oa]s?\b|\bcomiss(ão|ões)\b/i;

for (const [largura, altura] of [[390, 844], [1280, 900]] as const) {
  test.describe(`T438 — VOCAB-A a ${largura}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largura, height: altura });
    });

    test("1. /seguranca: morar com segurança, morador, sem aluguel nem comissão", async ({ page }) => {
      await page.goto("/seguranca", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Morar com segurança na Viva Nomads");
      const texto = await page.locator("main").innerText();
      expect(texto).toMatch(/\bmorador\b/);
      expect(texto).not.toMatch(PROIBIDAS);
      expect(texto).not.toMatch(/\balugu[eé]l\b|Alugar/i);
      await page.screenshot({ path: `tests/laboratorio/saida/t438-seguranca-${largura}.png`, fullPage: true });
    });

    test("2. /para-proprietarios: 'taxa de serviço' com os números da regra", async ({ page }) => {
      await page.goto("/para-proprietarios", { waitUntil: "domcontentloaded" });
      const texto = await page.locator("main").innerText();
      expect(texto).toContain("A taxa de serviço da Viva é de 12% sobre o valor total do contrato fechado");
      // E805: a escada inteira (12/10/8/6) no lugar da faixa resumida "de 12% a 6%".
      // 078 (Daniel, 16/11/2026): antes "… · 16–19 imóveis: 6%. Plano Gestor: {GESTOR_TEXTO}."; agora a escada termina em
      // "16–19 imóveis: 6%" e vem a linha de carteiras; o Plano Gestor e os 4% são cobrados como ausentes.
      expect(texto).toContain(`1–2 imóveis: 12% · 3–5 imóveis: 10% · 6–15 imóveis: 8% · 16–19 imóveis: 6%. ${TEXTO_CARTEIRAS}`);
      expect(texto).not.toMatch(/Plano Gestor|16 ou mais/i); // ORDEM-DUET-534: antes a negação era de "16–19"
      expect(achadosProibidos(texto).filter((a) => a.id === "plano-gestor-publico" || a.id === "taxa-de-4-publica")).toEqual([]);
      expect(texto).not.toMatch(/taxa negociável|condições negociadas/);
      expect(texto).not.toMatch(PROIBIDAS);
      await page.screenshot({ path: `tests/laboratorio/saida/t438-proprietarios-${largura}.png` });
    });

    for (const rota of ["/", "/como-funciona", "/empresas", "/guias"]) {
      test(`3. ${rota}: nenhum 'inquilino' nem 'comissão' na tela`, async ({ page }) => {
        await page.goto(rota, { waitUntil: "domcontentloaded" });
        expect(await page.locator("body").innerText()).not.toMatch(PROIBIDAS);
      });
    }

    test("4. /ajuda/seguranca: 'Esqueci minha senha' com a resposta nova (fonte única da assistente)", async ({ page }) => {
      // E84: as perguntas moram na página de cada tema ("Segurança e conta").
      await page.goto("/ajuda/seguranca", { waitUntil: "domcontentloaded" });
      expect(await page.content()).toContain("Você não precisa de senha: em Entrar, digite o seu e-mail e use o código de 6 dígitos que enviamos.");
    });
  });
}
