import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { linkAssinadoAprovar } from "../../../src/lib/agentes/avisos-daniel";

/*
  T1682 — Ordem 12a8086d, item 4: links de aprovação de USO ÚNICO (72 h) que abrem a tela autenticada.
  A regra (assinatura, prazo, 2ª abertura recusada, erro do banco = falha fechada) está provada no unitário
  src/lib/agentes/link-aprovacao.test.ts. Aqui, de ponta a ponta:
  1) visitante (ex.: leitor de links do e-mail) vai para o login com o destino guardado e NÃO gasta o link;
  2) admin com link adulterado ou sem parâmetros vê "não é válido" e o botão para a aba Aprovações, sem rolagem lateral;
  3) com o CRON_SECRET do ambiente no runner: o mesmo link abre a aba Aprovações na 1ª vez e é recusado na 2ª.
     Sem o segredo no runner, o caso 3 é pulado (o lab não guarda segredo do servidor).
*/
const RONDA = "00000000-0000-4000-8000-000000001682";
const ADULTERADO = `/admin/agentes/aprovar?r=${RONDA}&e=${Math.floor(Date.now() / 1000) + 3600}&s=${"0".repeat(32)}`;

test.describe("T1682 — link de aprovação de uso único", () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== "chromium", "só chromium"));

  test("visitante cai no login com o destino guardado (o link não é gasto)", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto(ADULTERADO);
    await expect(page).toHaveURL(/\/auth\?.*redirect=%2Fadmin%2Fagentes%2Faprovar/);
    await ctx.close();
  });

  for (const largura of [390, 1280]) {
    test(`admin com link adulterado vê o motivo e o atalho para Aprovações (${largura} px)`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(ADULTERADO);
      await expect(page.getByTestId("link-aprovacao-motivo")).toHaveAttribute("data-motivo", "invalido");
      await expect(page.getByTestId("link-aprovacao-motivo")).toContainText("não é válido");
      await expect(page.getByTestId("link-aprovacao-central")).toHaveAttribute("href", "/admin/agentes?aba=aprovacoes");
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(sobra).toBeLessThanOrEqual(0);
      await page.goto("/admin/agentes/aprovar");
      await expect(page.getByTestId("link-aprovacao-motivo")).toHaveAttribute("data-motivo", "invalido");
      await ctx.close();
    });
  }

  test("link verdadeiro: 1ª abertura vai para Aprovações; a 2ª é recusada", async ({ browser }) => {
    const segredo = process.env.CRON_SECRET;
    test.skip(!segredo, "CRON_SECRET do ambiente não está no runner do lab");
    const url = new URL(linkAssinadoAprovar(crypto.randomUUID(), new Date(), "http://x", segredo!));
    const caminho = `${url.pathname}${url.search}`;
    const ctx = await browser.newContext({ storageState: authFile("admin") });
    const page = await ctx.newPage();
    await page.goto(caminho);
    await expect(page).toHaveURL(/\/admin\/agentes\?aba=aprovacoes/);
    await page.goto(caminho);
    await expect(page.getByTestId("link-aprovacao-motivo")).toHaveAttribute("data-motivo", "usado");
    await ctx.close();
  });
});
