import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1189 — E543 (#2715, 05/11): o número público do contrato (VN-CT- + os 8 primeiros hex do id) nunca se repete. A 0301
 * põe um gatilho antes do insert: se o começo do id coincidir com o de um contrato existente, o id é sorteado de novo —
 * o contrato nasce sempre (regra da 0201). O E543 entrou só com teste de unidade; aqui é o banco do laboratório:
 *   1. um contrato A;
 *   2. um contrato B pedido com um id que começa igual ao de A → nasce, com outro id e OUTRO número (VN-CT-…);
 *   3. um contrato C pedido com um id livre → nasce com o id pedido (o gatilho só age na colisão).
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1189.${sufixo}@lab.vivanomads.test`, nome: "Nina Número", role: "owner" as const };
const inq = { email: `inq.t1189.${sufixo}@lab.vivanomads.test`, nome: "Otto Número", role: "tenant" as const };
const ids: { dono?: string; inq?: string } = {};
const contratos: string[] = [];
const numero = (id: string) => `VN-CT-${id.slice(0, 8).toUpperCase()}`;
/** Um id com os 8 primeiros hex dados e o resto sorteado (formato UUID v4). */
const idCom = (comeco: string) => `${comeco}-${crypto.randomUUID().slice(9)}`;

async function contrato(id?: string): Promise<string> {
  // Um imóvel por contrato: o teste é do número, não de dois contratos ativos no mesmo imóvel.
  const imovel = await criarImovelPronto(ids.dono!, `Contrato número t1189 ${contratos.length} ${sufixo}`, { ativo: true, preco: 3000 });
  const agora = new Date().toISOString();
  const { data, error } = await adm()
    .from("contratos")
    .insert({
      ...(id ? { id } : {}),
      property_id: imovel, tenant_id: ids.inq, owner_plan: "free", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3000,
      tamanho_bloco_meses: 2, comissao_percent: 0.1, comissao_valor: 600, qtd_ocupantes: 1, status: "ativo", garantia: "caucao",
      assinado_proprietario_em: agora, assinado_inquilino_em: agora,
    })
    .select("id")
    .single();
  if (error) throw error;
  contratos.push(data.id as string);
  return data.id as string;
}

test.describe("T1189 — E543: o número do contrato nunca se repete", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    if (contratos.length) await adm().from("contratos").delete().in("id", contratos);
    await apagarContas([ids.inq, ids.dono]);
  });

  test("id que colide no começo → o contrato nasce com outro número; id livre → nasce com o id pedido", async () => {
    const a = await contrato();
    const pedido = idCom(a.slice(0, 8));
    expect(numero(pedido)).toBe(numero(a));
    const b = await contrato(pedido);
    expect(b, "o gatilho sorteou outro id").not.toBe(pedido);
    expect(numero(b), "o número de B não repete o de A").not.toBe(numero(a));

    const livre = crypto.randomUUID();
    const c = await contrato(livre);
    expect(c, "sem colisão, o id pedido fica").toBe(livre);
  });
});
