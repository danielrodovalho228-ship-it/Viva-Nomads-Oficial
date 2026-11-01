import { test, expect } from "@playwright/test";
import { dataPedidoPorExtenso } from "../../../src/lib/pedidos/campos";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T764 — E319 (devolução de 31/10): no cartão do pedido de moradia do morador, "Fica no ar até o fim do dia" + a data
  POR EXTENSO ("1º de março de 2027"), no dia de Brasília. A data é a mesma; só a forma muda. A 390 e a 1280.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const morador = { email: `mor.t764.${sufixo}@lab.vivanomads.test`, nome: "Lara Pedido", role: "tenant" as const };
const ids: { morador?: string; expira?: string } = {};

test.describe("T764 — E319: data por extenso no pedido", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.morador = await criarConta(morador, senha);
    // Entrada em 01/03/2027: o pedido fica no ar até o fim do dia da entrada (23:59:59 de Brasília). O banco calcula o
    // expira_em (regra do E316); o spec lê o valor gravado em vez de supor.
    const { data, error } = await adm().from("pedidos_moradia").insert({
      inquilino_id: ids.morador, cidade: "Uberlândia", uf: "MG", data_inicio: "2027-03-01", prazo_meses: 2, orcamento_mensal: 3000,
      qtd_ocupantes: 1, motivo: "trabalho_remoto", expira_em: "2027-03-02T02:59:59Z",
    }).select("expira_em").single();
    expect(error).toBeNull();
    ids.expira = (data as { expira_em: string }).expira_em;
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
      // Por extenso ("1º de março de 2027"), no dia de Brasília do expira_em gravado — nunca dd/mm/aaaa.
      await expect(linha).toHaveText(`Fica no ar até o fim do dia ${dataPedidoPorExtenso(ids.expira)}`);
      await expect(linha).toHaveText(/^Fica no ar até o fim do dia (1º|\d{1,2}) de [a-zç]+ de \d{4}$/);
      await expect(linha).not.toHaveText(/\d{2}\/\d{2}\/\d{4}/);
      await p.screenshot({ path: `${SAIDA}/t764-pedido-${largura}.png` });
      await p.context().close();
    });
  }
});
