import { test, expect } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";

/*
  T911 — achado nº 35 (#1969, Pista B): a leitura dos pedidos dos parceiros lança no erro; /admin/parceiros/pedidos cai
  no error.tsx do admin em vez de "Nenhum pedido ainda" e números zerados.
  A falha do banco não se provoca no laboratório sem quebrar a massa compartilhada (fica com os testes unitários do PR);
  aqui, o caminho NORMAL depois da troca: com a sessão de admin, a página abre (lista ou estado vazio) SEM a tela de erro, a 1280 e a 390 px.
*/
const SAIDA = "tests/laboratorio/saida";
const TELAS: { rota: string; nome: string; conteudo: RegExp }[] = [
  { rota: "/admin/parceiros/pedidos", nome: "Pedidos de parceiros", conteudo: /pedido/i },
];

test.describe("T911 — achado nº 35: os pedidos de parceiros abrem sem a tela de erro (1280 e 390 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (sessão de admin).");

  for (const t of TELAS) {
    for (const largura of [1280, 390] as const) {
      test(`${t.nome} @${largura}: abre com o conteúdo, sem a tela de erro`, async ({ browser }) => {
        const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
        const page = await ctx.newPage();
        const r = await page.goto(t.rota, { waitUntil: "domcontentloaded" });
        expect(r?.status() ?? 0).toBeLessThan(400);
        expect(new URL(page.url()).pathname, "não saiu da tela").toBe(t.rota.split("?")[0]);
        await page.locator("main").first().waitFor({ timeout: 30_000 });
        await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
        await expect(page.getByTestId("admin-erro"), "a leitura funcionou: sem a tela 'Não conseguimos abrir…'").toHaveCount(0);
        const corpo = (await page.locator("main").first().innerText()).replace(/\s+/g, " ");
        console.log(`t911|${t.nome}|${largura}|${corpo.slice(0, 160)}`);
        expect(corpo, "o conteúdo da tela apareceu").toMatch(t.conteudo);
        await page.screenshot({ path: `${SAIDA}/t911-${t.nome.replace(/[^\w]+/g, "-")}-${largura}.png` });
        await ctx.close();
      });
    }
  }
});
