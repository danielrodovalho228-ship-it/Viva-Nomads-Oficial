import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1186 — E472 (#2628, 05/11): em Admin → Pedidos de moradia, a LISTA sai da mesma fonte dos números (o cliente de
 * serviço do admin já conferido). Antes ela saía do cliente da sessão, pela RLS is_admin() (que exige AAL2 de quem tem
 * 2FA verificado): numa sessão sem AAL2 a lista voltava vazia ("0 pedidos nesta lista" e "Nenhum pedido no sistema")
 * enquanto os números contavam. O E472 entrou só com teste de unidade; aqui é a tela, com a sessão de admin do
 * laboratório, 390 e 1280, e dois pedidos semeados numa cidade só do teste:
 *   1. os dois pedidos aparecem na lista (admin-pedido-linha com o id de cada um);
 *   2. o total da lista não é 0 e a tela não diz "Nenhum pedido no sistema";
 *   3. sem estouro horizontal.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const CIDADE = `Pedidópolis ${sufixo}`;
const inq = { email: `inq.t1186.${sufixo}@lab.vivanomads.test`, nome: "Rita Pedido", role: "tenant" as const };
const ids: { inq?: string; pedidos: string[] } = { pedidos: [] };

test.describe("T1186 — E472: a lista de Pedidos do admin mostra os pedidos que os números contam", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.inq = await criarConta(inq, senha);
    const hoje = new Date().toISOString().slice(0, 10);
    const pedido = { cidade: CIDADE, uf: "MG", data_inicio: hoje, prazo_meses: 2, orcamento_mensal: 3000, qtd_ocupantes: 1, motivo: "trabalho_remoto", expira_em: new Date(Date.now() + 20 * 86_400_000).toISOString(), inquilino_id: ids.inq };
    const { data, error } = await adm().from("pedidos_moradia").insert([pedido, { ...pedido, orcamento_mensal: 3500 }]).select("id");
    expect(error, error?.message).toBeNull();
    ids.pedidos = ((data ?? []) as { id: string }[]).map((p) => p.id);
    expect(ids.pedidos).toHaveLength(2);
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    if (ids.pedidos.length) await adm().from("pedidos_moradia").delete().in("id", ids.pedidos);
    await apagarContas([ids.inq]);
  });

  for (const w of [390, 1280] as const) {
    test(`os pedidos semeados aparecem na lista e o total não é 0 (${w})`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      try {
        const resp = await page.goto("/admin/pedidos", { waitUntil: "domcontentloaded" });
        expect(resp?.status() ?? 0).toBeLessThan(400);
        await expect(page.getByTestId("lista-total")).toBeVisible({ timeout: 30_000 });
        for (const id of ids.pedidos) await expect(page.locator(`[data-testid="admin-pedido-linha"][data-pedido="${id}"]`), id).toHaveCount(1);
        expect(Number(await page.getByTestId("lista-total").innerText())).toBeGreaterThanOrEqual(2);
        await expect(page.locator("main")).not.toContainText("Nenhum pedido no sistema");
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await ctx.close();
      }
    });
  }
});
