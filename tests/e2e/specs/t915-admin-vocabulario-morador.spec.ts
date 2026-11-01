import { test, expect } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";

/*
  T915 — #1977 (Pista A): nas telas do admin a pessoa que mora é "morador"; "inquilino" fica só no contrato. Em
  /admin/usuarios, na tela de verdade, a 1280 e a 390 px:
   - o filtro de papel diz "Proprietários e moradores" e "Morador" (o valor da URL segue papel=inquilino);
   - filtrando por morador (?papel=inquilino), o título/resumo diz "Moradores" e o papel de cada linha diz "Morador";
   - nenhum "Inquilino"/"inquilinos" visível na tela.
*/
const SAIDA = "tests/laboratorio/saida";

test.describe("T915 — #1977: admin diz 'morador', não 'inquilino' (1280 e 390 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (sessão de admin).");

  for (const largura of [1280, 390] as const) {
    test(`/admin/usuarios @${largura}: filtro e lista com 'morador'`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      await page.goto("/admin/usuarios", { waitUntil: "domcontentloaded" });
      const papel = page.getByTestId("filtro-papel");
      await expect(papel).toBeVisible({ timeout: 30_000 });
      const opcoes = await papel.locator("option").allInnerTexts();
      console.log(`t915|${largura}|opcoes|${opcoes.join(" · ")}`);
      expect(opcoes).toContain("Proprietários e moradores");
      expect(opcoes).toContain("Morador");
      expect(opcoes.join(" "), "nenhuma opção com 'inquilino'").not.toMatch(/inquilino/i);

      await page.goto("/admin/usuarios?papel=inquilino", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("filtro-papel")).toHaveValue("inquilino", { timeout: 30_000 });
      const texto = (await page.locator("main").first().innerText()).replace(/\s+/g, " ");
      console.log(`t915|${largura}|filtrado|${texto.slice(0, 200)}`);
      expect(texto, "o resumo do filtro diz Moradores").toContain("Moradores");
      expect(texto, "nenhum 'Inquilino' visível nas telas do admin").not.toMatch(/\bInquilinos?\b|\binquilinos\b/);
      await page.screenshot({ path: `${SAIDA}/t915-usuarios-moradores-${largura}.png` });
      await ctx.close();
    });
  }
});
