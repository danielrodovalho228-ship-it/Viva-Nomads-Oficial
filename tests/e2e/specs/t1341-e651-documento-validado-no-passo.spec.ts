import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, cpfAleatorio } from "../fixtures/laboratorio";

/*
  T1341 — E651 (#3023, na main): no formulário público "Seja parceiro" (/parceiros), o visitante SEM conta que digita um
  documento e aperta "Continuar: criar conta ou entrar" vê a validação no próprio passo (seja-parceiro-erro), junto do campo, e
  NÃO é levado ao login: CNPJ incompleto → "Informe o CNPJ com 14 dígitos"; CPF → "O CPF não é aceito"; CNPJ de dígito errado →
  "CNPJ inválido". 390 e 1280 px.
  Sem documento digitado o formulário também recusa (a versão mesclada confere sempre, antes de ir à conta).
*/
test.describe("T1341 — E651: documento do parceiro validado no passo", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 120_000 });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: o erro do documento aparece no passo, sem ir ao login`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
      try {
        const p = await ctx.newPage();
        await p.goto("/parceiros", { waitUntil: "domcontentloaded" });
        const doc = p.locator("#sp-doc");
        await expect(doc).toBeVisible({ timeout: 30_000 });
        await p.locator("#sp-nome").fill("Paula Parceira Servicos");
        const continuar = p.getByTestId("seja-parceiro-enviar");
        await expect(continuar).toContainText("Continuar: criar conta ou entrar");

        await doc.fill("12.345.678");
        await continuar.click();
        await expect(p.getByTestId("seja-parceiro-erro")).toContainText("Informe o CNPJ com 14 dígitos");
        expect(new URL(p.url()).pathname).toBe("/parceiros");

        await doc.fill(cpfAleatorio());
        await continuar.click();
        await expect(p.getByTestId("seja-parceiro-erro")).toContainText("O CPF não é aceito");
        expect(new URL(p.url()).pathname).toBe("/parceiros");

        await doc.fill("11.222.333/0001-00");
        await continuar.click();
        await expect(p.getByTestId("seja-parceiro-erro")).toContainText("CNPJ inválido");
        expect(new URL(p.url()).pathname).toBe("/parceiros");
        expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      } finally {
        await ctx.close();
      }
    });
  }
});
