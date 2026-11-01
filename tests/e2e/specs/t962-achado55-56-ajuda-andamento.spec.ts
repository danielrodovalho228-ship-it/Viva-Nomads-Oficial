import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T962 — #2074 (varredura de erros, rodada 7, achados 55 e 56): a falha de leitura não vira fila vazia nem contagem
 * falsa. Agora meusPedidosDeAjuda e filaAjudaPublicacaoAdmin LANÇAM: Meus imóveis mostra "Não foi possível carregar
 * o andamento dos seus pedidos de ajuda…" sem derrubar a lista, e a fila do admin cai no aviso de erro. As leituras
 * são do servidor (a falha em si fica com o teste de unidade do #2074, achado55-57-filas.test.ts); o que a tela real
 * prova, 390 e 1280, é que a guarda nova não dispara à toa — com um pedido de ajuda de verdade:
 *   • dono, Meus imóveis: o andamento do pedido aparece (ajuda-andamento) e nenhum aviso de falha;
 *   • admin, Ajuda para publicar: o pedido está na fila (o link do anúncio), sem o aviso de erro do admin.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t962.${sufixo}@lab.vivanomads.test`, nome: "Dalva Ajuda", role: "owner" as const };
const ids: { dono?: string } = {};
const LINK = `https://www.airbnb.com.br/rooms/t962${sufixo.replace(/\D/g, "").padEnd(6, "1")}`;

test.describe("T962 — #2074 achados 55/56: andamento e fila da ajuda para publicar sem falso erro", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    const { error } = await adm().from("pedidos_ajuda_publicacao").insert({ owner_id: ids.dono, link_anuncio: LINK, texto_anuncio: null, observacao: `t962 ${sufixo}`, fotos: [] });
    if (error) throw error;
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("pedidos_ajuda_publicacao").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.dono]);
  });

  test("dono: Meus imóveis mostra o andamento, sem aviso de falha (390 e 1280)", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    for (const largura of [390, 1280] as const) {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("ajuda-andamento")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("ajuda-andamento-falha")).toHaveCount(0);
      await expect(page.getByTestId("painel-erro")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    }
    await page.context().close();
  });

  test("admin: a fila de ajuda para publicar traz o pedido, sem o aviso de erro (390 e 1280)", async ({ browser }) => {
    for (const largura of [390, 1280] as const) {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      await page.goto("/admin/ajuda-publicacao", { waitUntil: "domcontentloaded" });
      await expect(page.getByText(LINK).first()).toBeAttached({ timeout: 30_000 });
      await expect(page.getByTestId("admin-erro")).toHaveCount(0);
      await ctx.close();
    }
  });
});
