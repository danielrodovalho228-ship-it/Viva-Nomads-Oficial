import { test, expect } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";

/*
  T897 — achado nº 25 (#1949, Pista B): Admin → Financeiro passou a avisar ("fin-aviso-leitura") quando não lê os
  contratos do período, as taxas vencidas ou as cobranças, em vez de "0 taxas vencidas" ou toda taxa "sem cobrança"
  calada. A falha do banco não se provoca no laboratório sem quebrar a massa compartilhada (fica com os testes unitários
  do PR); aqui, o caminho NORMAL depois da troca: com a sessão de admin, /admin/financeiro e o filtro de vencidas
  (?situacao=vencida, que liga a leitura das taxas vencidas) abrem SEM nenhum aviso de leitura, a 1280 e a 390 px.
*/
const SAIDA = "tests/laboratorio/saida";

test.describe("T897 — achado nº 25: Financeiro sem aviso falso de leitura (1280 e 390 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (sessão de admin).");

  for (const [rota, nome] of [["/admin/financeiro", "geral"], ["/admin/financeiro?situacao=vencida", "vencidas"]] as const) {
    for (const largura of [1280, 390] as const) {
      test(`${nome} @${largura}: sem 'fin-aviso-leitura'`, async ({ browser }) => {
        const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
        const page = await ctx.newPage();
        const r = await page.goto(rota, { waitUntil: "domcontentloaded" });
        expect(r?.status() ?? 0).toBeLessThan(400);
        expect(new URL(page.url()).pathname).toBe("/admin/financeiro");
        await page.locator("main").first().waitFor({ timeout: 30_000 });
        await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
        await expect(page.getByText(/Taxa|Financeiro/).first(), "a tela do Financeiro abriu").toBeVisible({ timeout: 30_000 });
        const avisos = await page.getByTestId("fin-aviso-leitura").allInnerTexts();
        console.log(`t897|${nome}|${largura}|avisos=${avisos.length}`);
        expect(avisos, "nenhuma leitura falhou: sem aviso").toEqual([]);
        await page.screenshot({ path: `${SAIDA}/t897-${nome}-${largura}.png` });
        await ctx.close();
      });
    }
  }
});
