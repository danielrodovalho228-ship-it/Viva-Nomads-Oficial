import { test, expect } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";

/*
  T895 — achado nº 22 (#1939, Pista B): "Meus chamados" da Central de Ajuda passou a ler com `exigir`; se a leitura falha,
  a tela mostra "meus-chamados-erro" com "Tentar de novo" em vez de "Você ainda não abriu nenhum chamado" (a pessoa
  abriria outro igual). A falha do banco não se provoca no laboratório sem quebrar a massa compartilhada (fica com os
  testes unitários do PR); aqui, o caminho NORMAL: com a sessão do morador, /ajuda/fale-com-a-viva mostra "Meus
  chamados" com a lista ou o estado vazio, e o aviso de erro não, a 1280 e a 390 px.
*/
const SAIDA = "tests/laboratorio/saida";

test.describe("T895 — achado nº 22: Meus chamados carrega sem aviso falso (1280 e 390 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (sessão do morador).");

  for (const largura of [1280, 390] as const) {
    test(`morador @${largura}: 'Meus chamados' com lista ou vazio, sem 'meus-chamados-erro'`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: authFile("inquilino"), viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      await page.goto("/ajuda/fale-com-a-viva", { waitUntil: "domcontentloaded" });
      const titulo = page.getByRole("heading", { name: "Meus chamados", exact: true });
      await expect(titulo).toBeVisible({ timeout: 30_000 });
      const secao = titulo.locator("xpath=..");
      // A leitura termina: some o "carregando" (lista === null) e fica a lista ou o estado vazio.
      await expect
        .poll(async () => (await secao.innerText()).replace(/\s+/g, " "), { timeout: 30_000 })
        .toMatch(/Você ainda não abriu nenhum chamado|VN-|Aberto|Respondido|Resolvido|Em andamento/);
      await expect(page.getByTestId("meus-chamados-erro"), "sem o aviso de falha").toHaveCount(0);
      console.log(`t895|${largura}|secao|${(await secao.innerText()).replace(/\s+/g, " ").slice(0, 200)}`);
      await titulo.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t895-meus-chamados-${largura}.png` });
      await ctx.close();
    });
  }
});
