import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, novaSenha, novoSufixo, cnpjAleatorio } from "../fixtures/laboratorio";

/*
  T1567 — E687 (#3292, migração 0326): empresa e veículo da categoria Mudança chegam ao parceiro. Guarda de BANCO no laboratório (todas as
  migrações aplicadas): parceiros.dados_categoria existe, é jsonb, nasce '{}' (not null) e guarda e devolve empresa/veículo sem perder campos.
  A 0328 (E689, #3401) só mexe em dados de contas de teste da produção (ids fixos a0327…) e não tem massa no laboratório: a guarda dela é o teste
  de unidade src/lib/qa/massa-estadia-semente-datas-0328.test.ts. Só no laboratório.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = { email: `parc.t1567.${sufixo}@lab.vivanomads.test`, nome: "Moacir Mudanças", role: "tenant" as const };
const ids: Record<string, string> = {};

test.describe("T1567 — E687: parceiros.dados_categoria (0326)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 90_000 });

  test.beforeAll(async () => {
    ids.u = await criarConta(conta, senha);
    const { data, error } = await adm().from("parceiros").insert({ user_id: ids.u, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: conta.nome, slug: `mudanca-t1567-${sufixo}`, categorias: ["mudanca"], cidades: ["Uberlândia"] }).select("id, dados_categoria").single();
    if (error) throw error;
    ids.p = data.id as string;
    ids.inicial = JSON.stringify(data.dados_categoria);
  });
  test.afterAll(async () => {
    if (ids.p) await adm().from("parceiros").delete().eq("id", ids.p);
    await apagarContas([ids.u]);
  });

  test("a coluna nasce como objeto vazio e não aceita nulo", async () => {
    expect(JSON.parse(ids.inicial)).toEqual({});
    const { error } = await adm().from("parceiros").update({ dados_categoria: null }).eq("id", ids.p);
    expect(error, "not null").not.toBeNull();
  });

  test("guarda e devolve empresa e veículo da Mudança", async () => {
    const dados = { empresa: "Mudanças Rápidas Ltda", veiculo: "Caminhão baú 3/4" };
    const { error } = await adm().from("parceiros").update({ dados_categoria: dados }).eq("id", ids.p);
    expect(error).toBeNull();
    const { data } = await adm().from("parceiros").select("dados_categoria").eq("id", ids.p).single();
    expect(data?.dados_categoria).toEqual(dados);
  });
});
