import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T764 — E319 (devolução de 31/10): no cartão do pedido de moradia do morador, "Fica no ar até o fim do dia" + a data
  POR EXTENSO ("1º de março de 2027"), no dia de Brasília. A data é a mesma; só a forma muda. A 390 e a 1280.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const morador = { email: `mor.t764.${sufixo}@lab.vivanomads.test`, nome: "Lara Pedido", role: "tenant" as const };
const ids: { morador?: string } = {};

test.describe("T764 — E319: data por extenso no pedido", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.morador = await criarConta(morador, senha);
    // Expira às 23:59:59 de Brasília de 01/03/2027 (= 02:59:59Z de 02/03).
    const { error } = await adm().from("pedidos_moradia").insert({
      inquilino_id: ids.morador, cidade: "Uberlândia", uf: "MG", data_inicio: "2027-02-01", prazo_meses: 2, orcamento_mensal: 3000,
      qtd_ocupantes: 1, motivo: "trabalho_remoto", expira_em: "2027-03-02T02:59:59Z",
    });
    expect(error).toBeNull();
  });
  test.afterAll(async () => {
    if (ids.morador) await adm().from("pedidos_moradia").delete().eq("inquilino_id", ids.morador);
    await apagarContas([ids.morador]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px`, async ({ browser }) => {
      const p = await entrar(browser, morador.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/pedidos", { waitUntil: "domcontentloaded" });
      const linha = p.getByText(/Fica no ar até o fim do dia/).first();
      await expect(linha).toBeVisible({ timeout: 30_000 });
      await expect(linha).toHaveText("Fica no ar até o fim do dia 1º de março de 2027");
      await p.screenshot({ path: `${SAIDA}/t764-pedido-${largura}.png` });
      await p.context().close();
    });
  }
});
