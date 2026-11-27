import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T870 — E470: Admin → Serviços do morador caía na tela de erro do admin.
 * Causa: o embed `profiles:tenant_id(full_name)` não existe (servicos_pedidos.tenant_id → auth.users, não profiles);
 * o PostgREST devolve PGRST200 mesmo sem linhas e o erro derrubava a tela. Prova no banco do laboratório:
 *  1. a leitura antiga dá erro de relação (reproduz o defeito);
 *  2. a leitura nova (a mesma de pedidosServicoAdmin) traz o pedido e o nome do morador vem de profiles à parte.
 */
test.describe("T870 — E470: leitura do admin de Serviços do morador", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  const senha = novaSenha();
  const sufixo = novoSufixo();
  const ids: { inq?: string; pedido?: string } = {};
  const COLUNAS = "id, servico_id, data_desejada, faixa, observacao, prestador_nome, preco_texto, status, criado_em, servicos_adicionais(nome)";

  test.beforeAll(async () => {
    ids.inq = await criarConta({ email: `inq.t870.${sufixo}@lab.vivanomads.test`, nome: "Iara Servicos", role: "tenant" }, senha);
    const { data: servico, error: e1 } = await adm().from("servicos_adicionais").select("id").limit(1).single();
    if (e1) throw e1;
    const { data, error } = await adm()
      .from("servicos_pedidos")
      .insert({ servico_id: servico.id, tenant_id: ids.inq, data_desejada: "2026-12-10", faixa: "manha", prestador_nome: "Prestador t870" })
      .select("id")
      .single();
    if (error) throw error;
    ids.pedido = data.id as string;
  });

  test.afterAll(async () => {
    if (ids.pedido) await adm().from("servicos_pedidos").delete().eq("id", ids.pedido);
    await apagarContas([ids.inq]);
  });

  test("a leitura antiga (embed de profiles pela tenant_id) dá erro de relação", async () => {
    const { error } = await adm().from("servicos_pedidos").select(`${COLUNAS}, profiles:tenant_id(full_name)`).limit(1);
    expect(error?.code).toBe("PGRST200");
  });

  test("a leitura nova traz o pedido com o serviço e o nome do morador", async () => {
    const { data, error } = await adm().from("servicos_pedidos").select(`${COLUNAS}, tenant_id`).eq("id", ids.pedido!).single();
    expect(error).toBeNull();
    expect((data!.servicos_adicionais as { nome?: string } | null)?.nome).toBeTruthy();
    const { data: perfis, error: e2 } = await adm().from("profiles").select("id, full_name").in("id", [data!.tenant_id as string]);
    expect(e2).toBeNull();
    expect(perfis?.[0]?.full_name).toBe("Iara Servicos");
  });
});
