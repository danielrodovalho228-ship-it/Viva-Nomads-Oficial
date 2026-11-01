import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T821 — #1781 (E319, QA do Muse), Pista C, bloco 134. O pedido de moradia ativo do morador diz até quando fica no ar
  com o dia inteiro: "Fica no ar até o fim do dia DD/MM/AAAA" (antes, "Fica no ar até DD/MM/AAAA" lia como se saísse do
  ar no começo do dia). Pela tela de verdade, a 390 e a 1280 px, com uma moradora nova e um pedido ativo, apagados no fim.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const morador = { email: `mor.t821.${sufixo}@lab.vivanomads.test`, nome: "Paula Pedido", role: "tenant" as const };
const ids: { morador?: string } = {};
const CIDADE = `Cidade T821 ${sufixo}`;

test.describe("T821 — E319: pedido de moradia fica no ar até o fim do dia (#1781)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.morador = await criarConta(morador, senha);
    await adm().from("profiles").update({ intencao: ["morar"] }).eq("id", ids.morador);
    const hoje = new Date().toISOString().slice(0, 10);
    const { error } = await adm().from("pedidos_moradia").insert({
      inquilino_id: ids.morador, cidade: CIDADE, uf: "MG", data_inicio: hoje, prazo_meses: 2, orcamento_mensal: 3000, qtd_ocupantes: 1,
      motivo: "trabalho_remoto", expira_em: new Date(Date.now() + 20 * 86_400_000).toISOString(), compativeis_ao_publicar: 0,
    });
    if (error) throw error;
  });
  test.afterAll(async () => {
    await adm().from("pedidos_moradia").delete().eq("cidade", CIDADE);
    await apagarContas([ids.morador!]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px: "Fica no ar até o fim do dia DD/MM/AAAA" no pedido ativo`, async ({ browser }) => {
      const p = await entrar(browser, morador.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/pedidos", { waitUntil: "domcontentloaded" });
      await expect(p.getByText(/Fica no ar até o fim do dia \d{2}\/\d{2}\/\d{4}/).first()).toBeVisible({ timeout: 30_000 });
      await expect(p.getByText(/Fica no ar até \d{2}\/\d{2}\/\d{4}/)).toHaveCount(0);
      await p.context().close();
    });
  }
});
