import { test, expect } from "@playwright/test";
import { achadosNoTexto } from "../../../src/lib/varredura-texto";

/*
  T172 — "Bom saber" completo (prompt 4, 17/10). Abre as 3 gavetas em 3 anúncios, a 390 e 1280 px:
  Cancelamento sem "aluguel" e com o que já é regra da plataforma; Segurança com as proteções da Viva
  e as declarações do anunciante (nunca "Não informado"); nenhuma palavra proibida dentro das gavetas
  (o t118 não as abre). No ube-005 a internet aparece só como "Internet fibra".
*/
const ANUNCIOS = ["ube-001", "ube-005", "ube-008"];

for (const largura of [390, 1280]) {
  test.describe(`T172 — Bom saber a ${largura}px`, () => {
    test.use({ viewport: { width: largura, height: 900 }, storageState: { cookies: [], origins: [] } });

    for (const id of ANUNCIOS) {
      test(`${id}: as 3 gavetas abrem com texto certo e sem palavra proibida`, async ({ page }) => {
        await page.goto(`/imoveis/${id}`, { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("bom-saber")).toBeVisible({ timeout: 20_000 });
        await expect(page.getByTestId("bom-saber-cancelamento")).toContainText("Antes do contrato assinado, nada é cobrado");
        await expect(page.getByTestId("bom-saber-seguranca")).not.toContainText("Não informado");

        for (const chave of ["cancelamento", "regras", "seguranca"]) {
          await page.getByTestId(`bom-saber-${chave}`).click();
          const janela = page.getByRole("dialog");
          await expect(janela).toBeVisible();
          const texto = await janela.innerText();
          expect(achadosNoTexto(texto, { termos: true, vocabulario: true }), `${id} · ${chave}`).toEqual([]);
          if (chave === "cancelamento") {
            await expect(janela).toContainText("Antes da assinatura, nada é cobrado.");
            await expect(janela).toContainText("conferência de saída");
            await expect(janela).toContainText("nunca retém o valor mensal");
          }
          if (chave === "seguranca") {
            await expect(janela).toContainText("protegidos até o aceite");
            await expect(janela).toContainText("chat da Viva");
            await expect(janela).toContainText("Sem câmeras no interior");
            await expect(janela).toContainText("Acesso:");
            await expect(janela).not.toContainText("Não informado");
          }
          await page.getByRole("button", { name: "Fechar" }).click();
          await expect(janela).toHaveCount(0);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      });
    }

    test("ube-005: internet só como \"Internet fibra\"", async ({ page }) => {
      await page.goto("/imoveis/ube-005", { waitUntil: "domcontentloaded" });
      await expect(page.locator("main")).toContainText("Internet fibra", { timeout: 20_000 });
      await expect(page.locator("main")).not.toContainText("Internet boa");
    });
  });
}
