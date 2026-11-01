import { test, expect } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";

/*
  T900 — achado nº 29 (#1959, Pista B): em /admin/solicitacoes, a taxa de solução por proprietário passou a avisar
  ("taxa-solucao-erro": "Não foi possível carregar a taxa de solução agora…") quando a leitura falha, em vez de dizer
  "Nenhum proprietário com 3 ou mais chamados resolvidos ainda". A falha do banco não se provoca no laboratório sem
  quebrar a massa compartilhada (fica com os testes unitários do PR); aqui, o caminho NORMAL depois da troca: com a
  sessão de admin, a página abre com a taxa (lista ou o estado vazio) e SEM o aviso de falha, a 1280 e a 390 px.
*/
const SAIDA = "tests/laboratorio/saida";

test.describe("T900 — achado nº 29: taxa de solução sem aviso falso de leitura (1280 e 390 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (sessão de admin).");

  for (const largura of [1280, 390] as const) {
    test(`/admin/solicitacoes @${largura}: a taxa de solução lida, sem 'taxa-solucao-erro'`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      const r = await page.goto("/admin/solicitacoes", { waitUntil: "domcontentloaded" });
      expect(r?.status() ?? 0).toBeLessThan(400);
      await page.locator("main").first().waitFor({ timeout: 30_000 });
      const secao = page.getByTestId("taxa-solucao");
      await expect(secao, "a seção 'Solução no prazo por proprietário' apareceu").toBeVisible({ timeout: 30_000 });
      await expect(secao).toContainText("Solução no prazo por proprietário");
      await expect(page.getByTestId("taxa-solucao-erro"), "sem o aviso de falha").toHaveCount(0);
      const corpo = (await secao.innerText()).replace(/\s+/g, " ");
      console.log(`t900|${largura}|vazio=${corpo.includes("Nenhum proprietário com 3 ou mais chamados resolvidos")}`);
      await page.screenshot({ path: `${SAIDA}/t900-solicitacoes-${largura}.png` });
      await ctx.close();
    });
  }
});
