import { test, expect } from "@playwright/test";

/**
 * T1596 — GUARDA DO E770/E771/E772 (#3586, merge na main em 09/11): /empresas publica o prazo de resposta (até 7 dias) e a taxa
 * ("a taxa da Viva é do proprietário, por contrato fechado"), diz que o pagamento da estadia vai direto ao proprietário e que os
 * serviços de parceiros são contratados à parte, e não anuncia mais "Relatórios (em construção)" nem "fatura" (quem emite é o
 * proprietário, e é RECIBO). /parceiros (Regras claras) diz que a divisão vale só para os serviços de parceiros e que o pagamento
 * da estadia vai direto ao proprietário. Páginas públicas, sem login nem banco, a 390 e 1280 px, sem rolagem lateral.
 */
for (const largura of [390, 1280]) {
  test.describe(`T1596 — E770/E771/E772: /empresas e /parceiros (${largura}px)`, () => {
    test.use({ viewport: { width: largura, height: 900 } });

    test("/empresas: prazo de 7 dias, taxa, escopo do pagamento, sem 'em construção' nem 'fatura'", async ({ page }) => {
      await page.goto("/empresas", { waitUntil: "domcontentloaded" });
      await expect(page.locator("h1").first()).toBeVisible({ timeout: 30_000 });
      const corpo = page.locator("body");
      await expect(page.getByTestId("empresas-como-funciona")).toContainText("Respondemos em até 7 dias com opções de imóveis mobiliados");
      const faq = page.getByTestId("empresas-faq");
      await expect(faq).toContainText("Qual é o prazo de resposta e a taxa?");
      await expect(faq).toContainText("A equipe responde em até 7 dias");
      await expect(faq).toContainText("A taxa da Viva é do proprietário, por contrato fechado");
      await expect(corpo).toContainText("pagamento da estadia vai direto ao proprietário");
      await expect(corpo).toContainText("Serviços de parceiros (limpeza, mudança) são contratados à parte");
      const texto = await corpo.innerText();
      expect(texto, "nada 'em construção' anunciado").not.toMatch(/em constru[çc][ãa]o/i);
      expect(texto, "sem 'Relatórios' como produto").not.toMatch(/relat[óo]rios/i);
      expect(texto, "quem emite é o proprietário e é recibo, não fatura").not.toMatch(/fatura/i);
      expect(texto).not.toContain("Ainda não há prazo de resposta");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });

    test("/parceiros: a divisão vale só para os serviços de parceiros; a estadia vai direto ao proprietário", async ({ page }) => {
      await page.goto("/parceiros", { waitUntil: "domcontentloaded" });
      const escopo = page.getByTestId("regras-escopo-pagamento");
      await expect(escopo).toBeAttached({ timeout: 30_000 });
      await expect(escopo).toContainText("Esta divisão vale só para os serviços de parceiros");
      await expect(escopo).toContainText("O pagamento da estadia vai direto ao proprietário");
      await expect(escopo).toContainText("a Viva não toca nesse dinheiro");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  });
}
