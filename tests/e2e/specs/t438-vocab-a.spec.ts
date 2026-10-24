import { test, expect } from "@playwright/test";

/**
 * T438 — VOCAB-A: o que o visitante lê usa o vocabulário da casa.
 *  1. /seguranca: "Morar com segurança na Viva Nomads", "morador" e nada de "inquilino", "aluguel" ou "comissão".
 *  2. /para-proprietarios: a cobrança da Viva se chama "taxa de serviço", com os números da regra (12% a 6%).
 *  3. Páginas públicas (home, /como-funciona, /empresas, /guias): nenhum "inquilino" nem "comissão" no texto da tela.
 *  4. /ajuda: a resposta de "Esqueci minha senha" começa por "Você não precisa de senha".
 *  Em 390 e 1280 px, com prints.
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
      expect(texto).toContain("de 12% a 6%; acima de 30 imóveis, condições negociadas");
      expect(texto).not.toMatch(PROIBIDAS);
      await page.screenshot({ path: `tests/laboratorio/saida/t438-proprietarios-${largura}.png` });
    });

    for (const rota of ["/", "/como-funciona", "/empresas", "/guias"]) {
      test(`3. ${rota}: nenhum 'inquilino' nem 'comissão' na tela`, async ({ page }) => {
        await page.goto(rota, { waitUntil: "domcontentloaded" });
        expect(await page.locator("body").innerText()).not.toMatch(PROIBIDAS);
      });
    }

    test("4. /ajuda: 'Esqueci minha senha' com a resposta nova (fonte única da assistente)", async ({ page }) => {
      await page.goto("/ajuda", { waitUntil: "domcontentloaded" });
      expect(await page.content()).toContain("Você não precisa de senha: em Entrar, digite o seu e-mail e use o código de 6 dígitos que enviamos.");
    });
  });
}
