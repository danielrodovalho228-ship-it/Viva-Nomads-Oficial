import { test, expect } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";

/*
  T909 — achado nº 33 (#1967, Pista B): a leitura dos pedidos de serviço dos moradores lança no erro; /admin/servicos cai
  no error.tsx do admin em vez de "Nenhum pedido de serviço dos moradores ainda" com "Pedidos novos" = 0.
  L-84 (achado desta spec, lab-crítico de #1984): /admin/servicos abre na tela de erro do admin MESMO com o banco no ar.
  pedidosServicoAdmin() lê `servicos_pedidos` com o embed `profiles:tenant_id(full_name)`, mas a 0174 liga
  servicos_pedidos.tenant_id a auth.users (não a profiles): o PostgREST não acha a relação e responde erro. Antes do
  #1967 o erro era engolido e a tela dizia "Nenhum pedido de serviço dos moradores ainda" sempre; agora o erro sobe e
  a tela inteira cai. Os dois casos ficam como test.fail ligado ao L-84 até a leitura deixar de usar o embed (ou a
  relação existir); a correção é de produto, não desta pista.
  A falha do banco não se provoca no laboratório sem quebrar a massa compartilhada (fica com os testes unitários do PR);
  aqui, o caminho NORMAL depois da troca: com a sessão de admin, a página abre (lista ou estado vazio) SEM a tela de erro, a 1280 e a 390 px.
*/
const SAIDA = "tests/laboratorio/saida";
const TELAS: { rota: string; nome: string; conteudo: RegExp }[] = [
  { rota: "/admin/servicos", nome: "Serviços", conteudo: /servi[çc]o|pedido/i },
];

test.describe("T909 — achado nº 33: /admin/servicos abre sem a tela de erro (1280 e 390 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (sessão de admin).");

  for (const t of TELAS) {
    for (const largura of [1280, 390] as const) {
      test(`${t.nome} @${largura}: abre com o conteúdo, sem a tela de erro — L-84`, async ({ browser }) => {
        test.fail(true, "L-84: a leitura de servicos_pedidos usa o embed profiles:tenant_id, sem relação (tenant_id → auth.users); a tela cai no error.tsx");
        const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
        const page = await ctx.newPage();
        const r = await page.goto(t.rota, { waitUntil: "domcontentloaded" });
        expect(r?.status() ?? 0).toBeLessThan(400);
        expect(new URL(page.url()).pathname, "não saiu da tela").toBe(t.rota.split("?")[0]);
        await page.locator("main").first().waitFor({ timeout: 30_000 });
        await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
        await expect(page.getByTestId("admin-erro"), "a leitura funcionou: sem a tela 'Não conseguimos abrir…'").toHaveCount(0);
        const corpo = (await page.locator("main").first().innerText()).replace(/\s+/g, " ");
        console.log(`t909|${t.nome}|${largura}|${corpo.slice(0, 160)}`);
        expect(corpo, "o conteúdo da tela apareceu").toMatch(t.conteudo);
        await page.screenshot({ path: `${SAIDA}/t909-${t.nome.replace(/[^\w]+/g, "-")}-${largura}.png` });
        await ctx.close();
      });
    }
  }
});
