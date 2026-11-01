import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { NO_LABORATORIO, adm } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";
import { lerMassa } from "../fixtures/varredura";

/*
  T930 — achado nº 42 (#2016, Pista B): /admin/parceiros/pedidos/[id] não vira mais "pedido não encontrado" (404) nem
  histórico vazio quando a leitura do pedido ou dos eventos falha — a falha sobe para o aviso do admin. A falha do banco
  não se provoca no laboratório sem quebrar a massa compartilhada (fica com os testes unitários do PR); aqui, o caminho
  NORMAL: um pedido de serviço semeado para o parceiro da massa (como na t865) abre no admin com HTTP 200, o código do
  pedido na tela e sem a tela de erro do admin, a 1280 e a 390 px. Um id que não existe segue dando "não encontrado"
  (a falha de leitura e o pedido inexistente são coisas diferentes). O pedido é apagado no fim.
*/
const SAIDA = "tests/laboratorio/saida";
const MASSA = lerMassa();
const codigo = `VN-SV-${randomBytes(4).toString("hex").toUpperCase()}`;
let pedido = "";

test.describe("T930 — achado nº 42 (#2016): o pedido do parceiro abre no admin (1280 e 390 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (sessão de admin e massa da varredura).");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    if (!MASSA) return;
    const { data, error } = await adm()
      .from("parceiro_pedidos")
      .insert({ codigo, parceiro_id: MASSA.parceiro, cliente_id: MASSA.ids.INQUILINA, categoria: "fotografia", descricao: "Fotos do apartamento (t930, achado nº 42).", status: "solicitado" })
      .select("id")
      .single();
    if (error) throw error;
    pedido = data.id as string;
  });
  test.afterAll(async () => {
    if (pedido) await adm().from("parceiro_pedidos").delete().eq("id", pedido);
  });

  for (const largura of [1280, 390] as const) {
    test(`pedido semeado @${largura}: abre com o código, sem a tela de erro`, async ({ browser }) => {
      expect(MASSA, "laboratório sem a massa da varredura").not.toBeNull();
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      const r = await page.goto(`/admin/parceiros/pedidos/${pedido}`, { waitUntil: "domcontentloaded" });
      expect(r?.status() ?? 0).toBeLessThan(400);
      await page.locator("main").first().waitFor({ timeout: 30_000 });
      await expect(page.getByTestId("admin-erro"), "sem a tela de erro do admin").toHaveCount(0);
      await expect(page.locator("main").first()).toContainText(codigo, { timeout: 30_000 });
      console.log(`t930|${largura}|${(await page.locator("main").first().innerText()).replace(/\s+/g, " ").slice(0, 200)}`);
      await page.screenshot({ path: `${SAIDA}/t930-pedido-${largura}.png` });
      await ctx.close();
    });
  }

  test("id inexistente: 'não encontrado', não a tela de erro de leitura", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("admin") });
    const page = await ctx.newPage();
    await page.goto(`/admin/parceiros/pedidos/00000000-0000-4000-8000-000000000000`, { waitUntil: "domcontentloaded" });
    await page.locator("main").first().waitFor({ timeout: 30_000 });
    await expect(page.getByTestId("admin-erro"), "inexistente não é falha de leitura").toHaveCount(0);
    const texto = (await page.locator("main").first().innerText()).replace(/\s+/g, " ");
    console.log(`t930|inexistente|${texto.slice(0, 160)}`);
    expect(texto).toMatch(/não encontrad|não existe|404/i);
    await ctx.close();
  });
});
