import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T852 — Onda 5 (matriz admin-servicos): em Admin → Serviços do morador, cada pedido mostra o imóvel ("Imóvel: título ·
  bairro, cidade"), como no mockup. Pedido semeado no laboratório com o imóvel ligado. 390 e 1280, sessão de admin.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const TITULO = `Studio Serviço ${sufixo}`;
const ids: { dono?: string; morador?: string; imovel?: string; pedido?: string } = {};

test.describe("T852 — admin/servicos: o imóvel no pedido", () => {
  test.skip(!NO_LABORATORIO, "precisa do laboratório (sessão de admin e banco local)");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
  });

  test.beforeAll(async () => {
    ids.dono = await criarConta({ email: `dono.t852.${sufixo}@lab.vivanomads.test`, nome: "Davi Serviço", role: "owner" }, senha);
    ids.morador = await criarConta({ email: `mor.t852.${sufixo}@lab.vivanomads.test`, nome: "Mia Serviço", role: "tenant" }, senha);
    ids.imovel = await criarImovelPronto(ids.dono, TITULO);
    const { data: cat, error: eCat } = await adm().from("servicos_adicionais").select("id").limit(1).single();
    if (eCat) throw eCat;
    const { data, error } = await adm()
      .from("servicos_pedidos")
      .insert({ servico_id: (cat as { id: string }).id, tenant_id: ids.morador, property_id: ids.imovel, data_desejada: "2026-12-10", faixa: "manha", prestador_nome: "Lavanderia T852" })
      .select("id")
      .single();
    if (error) throw error;
    ids.pedido = (data as { id: string }).id;
  });
  test.afterAll(async () => {
    if (ids.pedido) await adm().from("servicos_pedidos").delete().eq("id", ids.pedido);
    await apagarContas([ids.dono, ids.morador]);
  });

  test("o pedido mostra 'Imóvel: <título>' (390 e 1280)", async ({ browser }) => {
    for (const largura of [1280, 390]) {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      await page.goto("/admin/servicos", { waitUntil: "domcontentloaded" });
      const pedido = page.getByTestId("admin-servico-pedido").filter({ hasText: "Lavanderia T852" });
      await expect(pedido).toHaveCount(1, { timeout: 30_000 });
      await expect(pedido.getByTestId("admin-servico-imovel")).toHaveText(new RegExp(`^Imóvel: ${TITULO}`));
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await pedido.screenshot({ path: `tests/laboratorio/saida/t852-servico-${largura}.png` });
      await ctx.close();
    }
  });
});
