import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1148 — E470 (#2587, 05/11): Admin → Serviços do morador (/admin/servicos) abre. Antes a leitura com o embed de
 * profiles pela tenant_id dava PGRST200 e a tela caía no erro do admin. A t870 (Pista B) prova a leitura no banco;
 * aqui é a TELA, com a sessão de admin do laboratório, 390 e 1280, com um pedido semeado:
 *   1. a página responde abaixo de 400 e mostra a lista (admin-servicos-lista), sem a tela de erro;
 *   2. o pedido semeado aparece com o serviço, o NOME do morador (vindo de profiles à parte) e o prestador;
 *   3. sem estouro horizontal.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const inq = { email: `inq.t1148.${sufixo}@lab.vivanomads.test`, nome: "Ilda Servicos", role: "tenant" as const };
const PRESTADOR = `Prestador t1148 ${sufixo}`;
const ids: { inq?: string; pedido?: string } = {};

test.describe("T1148 — E470: a tela Serviços do morador do admin abre com o pedido e o nome do morador", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.inq = await criarConta(inq, senha);
    const { data: servico, error: e1 } = await adm().from("servicos_adicionais").select("id").limit(1).single();
    expect(e1, e1?.message).toBeNull();
    const { data, error } = await adm()
      .from("servicos_pedidos")
      .insert({ servico_id: servico!.id, tenant_id: ids.inq, data_desejada: "2026-12-10", faixa: "manha", prestador_nome: PRESTADOR })
      .select("id")
      .single();
    expect(error, error?.message).toBeNull();
    ids.pedido = data!.id as string;
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    if (ids.pedido) await adm().from("servicos_pedidos").delete().eq("id", ids.pedido);
    await apagarContas([ids.inq]);
  });

  for (const w of [390, 1280] as const) {
    test(`a tela abre e lista o pedido com o nome do morador (${w})`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      try {
        const resp = await page.goto("/admin/servicos", { waitUntil: "domcontentloaded" });
        expect(resp?.status() ?? 0).toBeLessThan(400);
        const lista = page.getByTestId("admin-servicos-lista");
        await expect(lista).toBeVisible({ timeout: 30_000 });
        const pedido = lista.getByTestId("admin-servico-pedido").filter({ hasText: PRESTADOR });
        await expect(pedido).toBeVisible();
        await expect(pedido).toContainText("Ilda");
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await ctx.close();
      }
    });
  }
});
