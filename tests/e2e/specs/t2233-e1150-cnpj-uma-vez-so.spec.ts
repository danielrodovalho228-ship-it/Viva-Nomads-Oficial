import { test, expect } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";

/*
  T2233 — E1150 (ORDEM-DUET-641): em /parceiros, a regra "só CNPJ" aparece UMA vez @E1150
  Só no laboratório (visitante, sem conta). Sem erro: a nota fixa (sp-so-cnpj) está lá. Com um CPF: a recusa junto do
  campo (sp-erro-documento) é a única instância da frase — a nota esconde-se.
*/
const FRASE = "A Viva só trabalha com parceiros que têm CNPJ";

test.describe("T2233 — E1150: a regra do CNPJ aparece uma vez só @E1150", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");

  for (const largura of [390, 1280]) {
    test(`${largura}px: sem erro a nota; com CPF só a recusa`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: largura, height: 900 } });
      const page = await ctx.newPage();
      await page.goto("/parceiros?seja=1#quero-ser-parceiro", { waitUntil: "domcontentloaded" });
      const form = page.getByTestId("seja-parceiro-form");
      await expect(form).toBeVisible({ timeout: 30_000 });
      const vezes = async () => (await form.innerText()).split(FRASE).length - 1;
      // Sem erro: a nota fixa está lá, uma vez.
      await expect(form.getByTestId("sp-so-cnpj")).toBeVisible();
      expect(await vezes(), "sem erro, a frase aparece uma vez (a nota)").toBe(1);
      // Com CPF: a recusa junto do campo, e só ela.
      await form.locator("#sp-nome").fill("Clara Limpezas");
      await form.locator("#sp-doc").fill("529.982.247-25");
      await page.getByTestId("seja-parceiro-enviar").click();
      await expect(form.getByTestId("sp-erro-documento")).toContainText(FRASE, { timeout: 20_000 });
      await expect(form.getByTestId("sp-so-cnpj")).toHaveCount(0);
      expect(await vezes(), "com o CPF recusado, a frase aparece uma vez (a recusa)").toBe(1);
      expect(page.url(), "o CPF não avança para criar a conta").not.toContain("/auth");
      await ctx.close();
    });
  }
});

test.describe("T2233 — E1150: outro erro do documento não esconde a nota @E1150", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test("1280px: CNPJ com dígito errado → recusa própria, e a nota do CNPJ continua", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto("/parceiros?seja=1#quero-ser-parceiro", { waitUntil: "domcontentloaded" });
    const form = page.getByTestId("seja-parceiro-form");
    await expect(form).toBeVisible({ timeout: 30_000 });
    await form.locator("#sp-nome").fill("Clara Limpezas");
    await form.locator("#sp-doc").fill("11.222.333/0001-82");
    await page.getByTestId("seja-parceiro-enviar").click();
    await expect(form.getByTestId("sp-erro-documento")).toContainText("CNPJ inválido", { timeout: 20_000 });
    await expect(form.getByTestId("sp-so-cnpj")).toBeVisible();
    await ctx.close();
  });
});
