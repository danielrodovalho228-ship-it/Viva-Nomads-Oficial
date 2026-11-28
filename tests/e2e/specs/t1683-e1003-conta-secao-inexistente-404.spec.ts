import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";

/*
  T1683 — E1003 (Gerente, ronda 20:04 de 16/11/2026): a seção inexistente da Conta responde o 404 do resto do site.
  Antes: /dashboard/conta/<qualquer coisa> respondia 200 com a tela "Página não encontrada" do painel; o resto do painel
  (/dashboard/<qualquer coisa>) responde 404. Agora os dois respondem igual: 404, com a mesma tela.
  O que NÃO muda e o teste cobra junto: toda seção que existe continua 200; a sessão continua de pé depois do 404
  (E428); e, sem sessão, o endereço continua levando ao login.
*/
const INEXISTENTE = "/dashboard/conta/secao-que-nao-existe";
const RESTO_DO_PAINEL = "/dashboard/pagina-que-nao-existe";
const SECOES_QUE_EXISTEM = ["perfil", "papeis", "dados", "privacidade", "seguranca", "pagamentos", "ajuda", "perfil-publico", "excluir", "plano"];

test.describe("T1683 — E1003: seção inexistente da Conta responde 404", () => {
  test.describe("com sessão", () => {
    test.skip(!hasAccount("inquilino"), "Sem a conta de teste inquilino.");
    test.use({ storageState: authFile("inquilino") });

    for (const largura of [390, 1280] as const) {
      test(`a ${largura} px: 404 e a mesma tela do resto do painel`, async ({ page }) => {
        await page.setViewportSize({ width: largura, height: 900 });
        const resto = await page.goto(RESTO_DO_PAINEL, { waitUntil: "domcontentloaded" });
        expect(resto?.status(), "o padrão: endereço que não existe no painel").toBe(404);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText("Página não encontrada");
        const telaDoResto = await page.locator("main").first().innerText();

        const resposta = await page.goto(INEXISTENTE, { waitUntil: "domcontentloaded" });
        expect(resposta?.status(), "seção inexistente da Conta").toBe(404);
        expect(new URL(page.url()).pathname, "o endereço fica o que a pessoa abriu").toBe(INEXISTENTE);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText("Página não encontrada");
        expect(await page.locator("main").first().innerText(), "a mesma tela do resto do painel").toBe(telaDoResto);
      });
    }

    test("toda seção que existe continua respondendo 200, sem a tela de não encontrada", async ({ page }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width: 1280, height: 900 });
      for (const secao of SECOES_QUE_EXISTEM) {
        const r = await page.goto(`/dashboard/conta/${secao}`, { waitUntil: "domcontentloaded" });
        expect(r?.status(), `/dashboard/conta/${secao}`).toBe(200);
        await expect(page.locator("h1:visible").first(), `/dashboard/conta/${secao}`).not.toHaveText("Página não encontrada", { timeout: 20_000 });
      }
    });

    test("a sessão continua de pé depois do 404 (E428)", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      expect((await page.goto(INEXISTENTE, { waitUntil: "domcontentloaded" }))?.status()).toBe(404);
      const r = await page.goto("/dashboard/conta/dados", { waitUntil: "domcontentloaded" });
      expect(r?.status()).toBe(200);
      expect(new URL(page.url()).pathname).toBe("/dashboard/conta/dados");
      await expect(page.locator("h1:visible").first()).toHaveText("Meus dados", { timeout: 20_000 });
    });
  });

  test("sem sessão: o endereço continua levando ao login, com o destino guardado", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    try {
      await page.goto(INEXISTENTE, { waitUntil: "domcontentloaded" });
      await expect.poll(() => new URL(page.url()).pathname, { timeout: 20_000 }).toBe("/auth");
      expect(new URL(page.url()).searchParams.get("redirect")).toBe(INEXISTENTE);
    } finally {
      await ctx.close();
    }
  });
});
