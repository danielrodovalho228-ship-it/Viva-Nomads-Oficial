import { test, expect } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";

/*
  T890 — #1932 (Pista A, varredura 01/11): os três campos que não tinham rótulo para leitor de tela agora têm, na tela
  de verdade, a 1280 e a 390 px:
   - Admin → Sistema, "Testar leitura": a lista do tipo ("Tipo do arquivo") e o campo do arquivo ("Arquivo fictício
     para testar a leitura");
   - Indicações (/dashboard/indicacoes): o campo do link ("Seu link de indicação"), que é só leitura e mostra o link.
  O nome acessível é o que o leitor de tela lê (getByLabel/toHaveAccessibleName), não só o atributo.
*/
const SAIDA = "tests/laboratorio/saida";

test.describe("T890 — #1932: rótulo para leitor de tela em três campos (1280 e 390 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (sessões de admin e de proprietário).");

  for (const largura of [1280, 390] as const) {
    test(`Admin → Sistema: tipo e arquivo do 'Testar leitura' com nome acessível (${largura} px)`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      await page.goto("/admin/sistema", { waitUntil: "domcontentloaded" });
      const tipo = page.getByTestId("testar-leitura-tipo");
      await expect(tipo).toBeAttached({ timeout: 30_000 });
      await expect(tipo).toHaveAccessibleName("Tipo do arquivo");
      await expect(page.getByLabel("Tipo do arquivo", { exact: true })).toHaveCount(1);
      const arquivo = page.getByTestId("testar-leitura-arquivo");
      await expect(arquivo).toHaveAccessibleName("Arquivo fictício para testar a leitura");
      await tipo.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t890-admin-sistema-${largura}.png` });
      await ctx.close();
    });

    test(`Indicações: o campo do link com nome acessível e o link dentro (${largura} px)`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: authFile("proprietario"), viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      await page.goto("/dashboard/indicacoes", { waitUntil: "domcontentloaded" });
      const link = page.getByLabel("Seu link de indicação", { exact: true });
      await expect(link).toBeVisible({ timeout: 30_000 });
      await expect(link).toHaveAttribute("readonly", "");
      await expect(link).toHaveValue(/^https?:\/\/\S+/);
      await page.screenshot({ path: `${SAIDA}/t890-indicacoes-${largura}.png` });
      await ctx.close();
    });
  }
});
