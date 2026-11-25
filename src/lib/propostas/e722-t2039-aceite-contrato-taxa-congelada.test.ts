/*
  t2039 · E722 (Pista 3, lote 2, item E7) @E722   (sem @ao-vivo-seguro: mexe em taxa de contrato)
  Regra: aceite dentro do prazo → o contrato nasce com a TAXA CONGELADA no aceite (e com os valores acordados da
  proposta), nunca com a de hoje nem com a do anúncio; nas reaberturas a taxa não muda (t2038).
  A cadeia, com as funções REAIS:
    1. o aceite grava a mesma `taxa` em propostas.taxa_congelada e em leads.accepted_commission_rate (nos dois caminhos
       do lead) e só abre a janela de 72 h com a chave ligada (leitura do código: o aceite é Server Action);
    2. a proposta aceita (dentro da janela, status "aceita") é a ACORDADA do lead: propostaAcordadaDoLead devolve os
       valores e a taxa dela; taxaDoLeadDoDono devolve a taxa congelada do lead;
    3. registrarContrato usa taxaDoContrato(taxa congelada) e grava comissao_percent = resumo.comissaoPercent, com o
       aluguel da proposta acordada; taxaDoContrato devolve a congelada; resumoContratoEmDias a mantém (30 a 180 dias).
  Não testa nenhuma regra de "menor taxa entre envio e aceite" (instrução do coordenador; ver o PR).
  Roda: node --test src/lib/propostas/e722-t2039-aceite-contrato-taxa-congelada.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "./e722-tela-harness/proposta.ts"; // registra o loader (server-only e os atalhos @/)
import { taxaDoContrato, TAXAS_HISTORICAS } from "../../config/planos.ts";
import { resumoContratoEmDias } from "../contrato-blocos.ts";
import { taxaSobreDias } from "../estadia-em-dias.ts";

const { propostaAcordadaDoLead } = await import("../data/propostas-servidor.ts");
const { taxaDoLeadDoDono } = await import("../data/taxa-dono-servidor.ts");
const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

/** Supabase de serviço em memória: select + eq/in/order/limit + maybeSingle. */
function banco(tabelas: Record<string, Record<string, unknown>[]>) {
  return {
    from(t: string) {
      const f: ((l: Record<string, unknown>) => boolean)[] = [];
      const b = {
        select: () => b,
        eq: (c: string, v: unknown) => (f.push((l) => l[c] === v), b),
        in: (c: string, vs: unknown[]) => (f.push((l) => vs.includes(l[c])), b),
        order: () => b,
        limit: () => b,
        maybeSingle: async () => ({ data: (tabelas[t] ?? []).find((l) => f.every((x) => x(l))) ?? null, error: null }),
      };
      return b;
    },
  } as never;
}

const VERSAO = { proposta_id: "p1", versao: 2, valor_mensal: 2800, meses: 6, dias: 180, data_entrada: "2026-12-20", condominio: 450, consumo: 200, limpezas_mes: 0, limpezas_pacote: null, valor_limpeza: 0, taxa_pet: 0, limpeza_unica: 0 };

test("E7 (1): o aceite congela a MESMA taxa na proposta e no lead, e só abre a janela de 72 h com a chave ligada", () => {
  const src = ler("src/lib/data/propostas-actions.ts");
  const aceitar = src.slice(src.indexOf("async function aceitar("), src.indexOf("export async function reabrirPreAceitacao"));
  assert.match(aceitar, /\.update\(\{ status: "aceita", aceita_em: agora\.toISOString\(\), taxa_congelada: taxa, [^\n]*\.\.\.\(PRE_ACEITACAO_72H_ATIVA \? \{ pre_aceitacao_ate: prazoDaPreAceitacao\(agora, String\(v\.data_entrada\)\.slice\(0, 10\)\)\.toISOString\(\), pre_aceitacao_reaberturas: 0 \} : \{\}\) \}\)/);
  // Os dois caminhos do lead (nova → aceita; já aceita) gravam a mesma taxa congelada.
  assert.equal((aceitar.match(/accepted_commission_rate: taxa,/g) ?? []).length, 2);
  // O aceite só vale com a proposta aberta na versão vigente (nunca reaplica uma taxa sobre proposta já aceita).
  assert.match(aceitar, /\.eq\("versao_atual", v\.versao\)\s*\.in\("status", \["enviada", "vista", "contraproposta"\]\)/);
});

test("E7 (2): dentro da janela (status 'aceita') a proposta é a acordada do lead, com os valores e a taxa dela", async () => {
  const admin = banco({
    propostas: [{ id: "p1", lead_id: "l1", numero: "ORC-1", versao_atual: 2, taxa_congelada: 0.08, status: "aceita" }],
    proposta_versoes: [VERSAO],
  });
  const a = (await propostaAcordadaDoLead(admin, "l1"))!;
  assert.ok(a, "a proposta aceita é a acordada");
  assert.deepEqual([a.id, a.valorMensal, a.dias], ["p1", 2800, 180]);
  assert.equal((a as unknown as { taxa: number }).taxa, 0.08);
  // Proposta que não chegou ao aceite (enviada/contraproposta) não vira contrato.
  for (const status of ["enviada", "contraproposta", "recusada"]) {
    const b = banco({ propostas: [{ id: "p1", lead_id: "l1", numero: "ORC-1", versao_atual: 2, taxa_congelada: null, status }], proposta_versoes: [VERSAO] });
    assert.equal(await propostaAcordadaDoLead(b, "l1"), null, status);
  }
});

test("E7 (2): o contrato lê do lead a taxa congelada no aceite", async () => {
  const admin = banco({ leads: [{ id: "l1", owner_id: "d1", accepted_plan: "free", accepted_commission_rate: 0.06 }] });
  assert.deepEqual(await taxaDoLeadDoDono(admin, "d1", "l1"), { acceptedPlan: "free", acceptedCommissionRate: 0.06 });
});

test("E7 (3): o contrato usa a taxa congelada (não a do plano de hoje) e o aluguel acordado, de 30 a 180 dias", () => {
  const src = ler("src/lib/data/actions.ts");
  const reg = src.slice(src.indexOf("export async function registrarContrato("));
  assert.match(reg, /const aluguel = acordada \? acordada\.valorMensal : Number\(imovel\?\.monthly_price\);/);
  // E1141 (guarda 2): a congelada da proposta acordada (taxa_congelada); sem ela, a do aceite gravada na candidatura.
  assert.match(reg, /const rate = taxaDoContrato\(taxaDaEstadia\(acordada\?\.taxa, taxaLead\?\.acceptedCommissionRate\), taxaLead\?\.acceptedPlan \?\? null\);/);
  assert.match(reg, /resumoContratoEmDias\(diasExatos, aluguel, rate, tamanho\)/);
  assert.match(reg.slice(reg.indexOf('.from("contratos")\n    .insert(')), /comissao_percent: resumo\.comissaoPercent,\s*comissao_valor: resumo\.comissaoValor,/);
  for (const congelada of TAXAS_HISTORICAS) {
    // Plano de hoje diferente (o Profissional tem outra taxa): vale a congelada.
    assert.equal(taxaDoContrato(congelada, "free"), congelada, `congelada ${congelada}`);
    for (const dias of [30, 90, 180]) {
      const r = resumoContratoEmDias(dias, 2800, taxaDoContrato(congelada, "free"));
      assert.equal(r.comissaoPercent, congelada, `${dias} dias`);
      assert.equal(r.comissaoValor, taxaSobreDias(2800, dias, congelada), `${dias} dias`);
    }
  }
});
