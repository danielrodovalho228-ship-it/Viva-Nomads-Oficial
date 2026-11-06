import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { randomBytes } from "node:crypto";

/**
 * T1284 — guarda do E543 (reprova de 05/11, migração 0301). O número público do contrato é "VN-CT-" + os 8 primeiros hex do
 * id (E331). A semente da massa deu a dois contratos DIFERENTES ids com o mesmo começo, e o admin mostrou o mesmo número duas
 * vezes. A correção tem duas partes, e esta spec trava as duas no banco do laboratório:
 *   1. coerência: nenhum par de contratos tem o mesmo número público (os 8 primeiros hex do id);
 *   2. prevenção: contrato novo cujo id começa igual ao de um existente NASCE (nunca é impedido), mas com outro id.
 * Não é tela: roda uma vez, no banco (service role).
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1284.${sufixo}@lab.vivanomads.test`, nome: "Dora Numero Sobrenome", role: "owner" as const };
const inq = { email: `inq.t1284.${sufixo}@lab.vivanomads.test`, nome: "Iara Numero Sobrenome", role: "tenant" as const };
const ids: Record<string, string> = {};
const criados: string[] = [];
const comeco = (id: string) => id.slice(0, 8).toLowerCase();

async function inserirContrato(id: string) {
  return adm()
    .from("contratos")
    .insert({
      id,
      property_id: ids.imovel,
      tenant_id: ids.inq,
      owner_plan: "essential",
      faixa: "media_estadia",
      prazo_total_dias: 60,
      aluguel_mensal: 3200,
      tamanho_bloco_meses: 2,
      comissao_percent: 0.12,
      comissao_valor: 768,
      qtd_ocupantes: 1,
      garantia: "caucao",
      status: "ativo",
    })
    .select("id")
    .single();
}

test.describe("T1284 — E543: o número público do contrato é único", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Imovel numero unico t1284 ${sufixo}`, { ativo: true });
  });
  test.afterAll(async () => {
    if (criados.length) await adm().from("contratos").delete().in("id", criados);
    await apagarContas([ids.dono, ids.inq]);
  });

  test("prevenção: o contrato cujo id começa igual ao de outro nasce, com outro id", async () => {
    const prefixo = randomBytes(4).toString("hex");
    const idA = `${prefixo}-0000-4000-8000-000000000011`;
    const idB = `${prefixo}-0000-4000-8000-000000000021`;
    const a = await inserirContrato(idA);
    expect(a.error, "o primeiro contrato nasce").toBeNull();
    criados.push(a.data!.id);
    expect(a.data!.id).toBe(idA);

    const b = await inserirContrato(idB);
    expect(b.error, "o segundo nasce também: a regra nunca impede o contrato").toBeNull();
    criados.push(b.data!.id);
    expect(b.data!.id, "o id sorteado de novo, diferente do pedido").not.toBe(idB);
    expect(comeco(b.data!.id), "e o número público (8 primeiros hex) não repete o do primeiro").not.toBe(comeco(idA));
  });

  test("coerência: nenhum par de contratos do banco tem o mesmo número público", async () => {
    const todos: string[] = [];
    for (let de = 0; ; de += 1000) {
      const { data, error } = await adm().from("contratos").select("id").range(de, de + 999);
      expect(error).toBeNull();
      todos.push(...(data ?? []).map((c) => c.id as string));
      if (!data || data.length < 1000) break;
    }
    const porNumero = new Map<string, string[]>();
    for (const id of todos) porNumero.set(comeco(id), [...(porNumero.get(comeco(id)) ?? []), id]);
    const repetidos = [...porNumero.entries()].filter(([, v]) => v.length > 1).map(([k, v]) => `VN-CT-${k.toUpperCase()} ← ${v.join(", ")}`);
    expect(repetidos, "números públicos de contrato repetidos").toEqual([]);
  });
});
