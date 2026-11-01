import { test, expect } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";

/*
  T927 — achado nº 39 (#2009, Pista B): /admin/avaliadores e a designação passaram a LANÇAR quando qualquer uma das ~11
  leituras da rede de avaliadores falha (credenciamentos, preços, fila, auditoria, pedidos, bloqueios, strikes, laudos,
  contestações, devoluções, sem laudo), em vez de "Nenhum pedido de credenciamento" com números zerados.
  A falha do banco não se provoca no laboratório sem quebrar a massa compartilhada (fica com os testes unitários do PR);
  aqui, o caminho NORMAL depois da troca — e é ele que pega uma leitura que agora LANÇA sem a tela ter caído antes (como
  o L-84): com a sessão de admin, a tela abre na rota, sem a tela de erro do admin, com o conteúdo, a 1280 e a 390 px.
*/
const SAIDA = "tests/laboratorio/saida";

test.describe("T927 — achado nº 39 (#2009): /admin/avaliadores abre sem a tela de erro (1280 e 390 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (sessão de admin).");

  for (const largura of [1280, 390] as const) {
    test(`/admin/avaliadores @${largura}: abre com o conteúdo, sem a tela de erro`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      const r = await page.goto("/admin/avaliadores", { waitUntil: "domcontentloaded" });
      expect(r?.status() ?? 0).toBeLessThan(400);
      expect(new URL(page.url()).pathname, "não saiu da tela").toBe("/admin/avaliadores");
      await page.locator("main").first().waitFor({ timeout: 30_000 });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await expect(page.getByTestId("admin-erro"), "a leitura funcionou: sem a tela 'Não conseguimos abrir…'").toHaveCount(0);
      const corpo = (await page.locator("main").first().innerText()).replace(/\s+/g, " ");
      console.log(`t927|${largura}|${corpo.slice(0, 200)}`);
      expect(corpo, "o conteúdo da tela apareceu").toMatch(/avaliador|credenciamento/i);
      await page.screenshot({ path: `${SAIDA}/t927-${largura}.png` });
      await ctx.close();
    });
  }
});
