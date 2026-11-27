import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";

/*
  T902 — E467 (PC11): o rodapé das páginas públicas oferece "Entrar ou cadastrar" só para quem NÃO está logado — com a
  sessão (cabeçalho "Meu painel"), o link some; "Meu painel" segue no rodapé. Página pública do parceiro e a home.
  390 e 1280.
*/
const ROTAS = ["/parceiros", "/"];

for (const w of [1280, 390] as const) {
  test.describe(`T902 — E467 a ${w} px`, () => {
    test.use({ viewport: { width: w, height: w === 390 ? 844 : 900 } });

    test.describe("visitante", () => {
      test.use({ storageState: { cookies: [], origins: [] } });
      test("o rodapé oferece entrar ou cadastrar", async ({ page }) => {
        for (const rota of ROTAS) {
          await page.goto(rota, { waitUntil: "domcontentloaded" });
          await expect(page.locator("footer").getByTestId("rodape-entrar"), rota).toHaveText("Entrar ou cadastrar", { timeout: 20_000 });
        }
      });
    });

    test.describe("logado", () => {
      test.skip(!hasAccount("inquilino"), "conta de teste do morador não configurada");
      test.use({ storageState: authFile("inquilino") });
      test("o rodapé não oferece entrar; 'Meu painel' fica", async ({ page }) => {
        for (const rota of ROTAS) {
          await page.goto(rota, { waitUntil: "domcontentloaded" });
          // No computador o cabeçalho mostra "Meu painel"; no celular ele fica dentro do menu.
          if (w === 1280) await expect(page.locator("header").getByText("Meu painel").first(), `${rota}: cabeçalho logado`).toBeVisible({ timeout: 20_000 });
          const rodape = page.locator("footer");
          // O servidor desenha o estado deslogado; com a sessão lida no navegador, o link sai.
          await expect(rodape.getByTestId("rodape-entrar"), rota).toHaveCount(0, { timeout: 20_000 });
          await expect(rodape.getByText("Entrar ou cadastrar"), rota).toHaveCount(0);
          await expect(rodape.getByRole("link", { name: "Meu painel" }), rota).toHaveAttribute("href", "/dashboard");
        }
      });
    });
  });
}
