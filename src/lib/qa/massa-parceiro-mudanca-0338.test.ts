/*
  E687 (correção da 0329) — migração 0338: a massa do parceiro de Mudança nunca nasceu em produção porque a guarda da 0329
  parava com QUALQUER pedido da conta (inquilino2 tinha um pedido de limpeza RECUSADO). A 0338 cria a mesma massa com a
  guarda certa. Roda: node --test src/lib/qa/massa-parceiro-mudanca-0338.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { linhasDadosDaCategoria } from "../parceiros/regras.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const sem = (s: string) => s.replace(/^\s*--.*$/gm, "");
const MIG = "supabase/migrations/0338_qa_parceiro_mudanca_correcao_e687.sql";
const APLICAR = "supabase/producao/aplicar-0338.sql";
// Os pedidos que o índice parceiro_solicitacoes_uma_aberta_conta considera ABERTOS (fonte: 0197/0238).
const ABERTOS = ["aguardando_email", "pendente", "aprovada"];

/** Avalia a guarda da 0338 como o SQL faz: para se há parceiro na conta ou pedido ABERTO (recusado/ativado não param). */
function guardaPara(sql: string, conta: { temParceiro: boolean; pedidos: string[] }): boolean {
  const m = /user_id = v_user and status in \(([^)]+)\)/.exec(sql);
  assert.ok(m, "guarda de pedido aberto não encontrada");
  const bloqueia = m![1].split(",").map((s) => s.trim().replace(/'/g, ""));
  assert.deepEqual(bloqueia, ABERTOS, "a guarda usa o mesmo conjunto do índice de pedido aberto");
  return conta.temParceiro || conta.pedidos.some((p) => bloqueia.includes(p));
}

for (const arquivo of [MIG, APLICAR]) {
  test(`${arquivo}: o estado real da conta (só um pedido de limpeza RECUSADO) não para a massa; parceiro ou pedido aberto param`, () => {
    const sql = sem(ler(arquivo));
    assert.equal(guardaPara(sql, { temParceiro: false, pedidos: ["recusada"] }), false, "o caso que fez a 0329 não criar nada");
    assert.equal(guardaPara(sql, { temParceiro: true, pedidos: [] }), true);
    for (const p of ABERTOS) assert.equal(guardaPara(sql, { temParceiro: false, pedidos: [p] }), true, p);
    // A guarda velha (qualquer pedido) não volta.
    assert.doesNotMatch(sql, /from public\.parceiro_solicitacoes where user_id = v_user or id = c_solicitacao/);
  });

  test(`${arquivo}: cria o parceiro de Mudança publicado com empresa e veículo, só conta de teste, ids fixos`, () => {
    const sql = sem(ler(arquivo));
    assert.match(sql, /'inquilino2@vivanomads\.com\.br' and is_teste/);
    assert.match(sql, /array\['mudanca'\], array\['Uberlândia'\], 'Parceiro de teste de Mudança \(E687\)\.', 'publicado', now\(\), c_dados\)/);
    assert.match(sql, /'a0329000-0000-4000-8000-000000000011'/);
    assert.match(sql, /'empresa', '\[TESTE QA\] Mudanças Teste E687 Ltda', 'veiculo', 'Caminhão baú de teste \(sem placa real\)'/);
    assert.doesNotMatch(sql, /\b(delete|update)\s+(from\s+)?public\./i, "não mexe no pedido recusado nem em nada além dos inserts");
    assert.doesNotMatch(sql, /AUTOMACOES_ATIVO|D5D50247/);
  });
}

test("o painel do parceiro mostra exatamente a empresa e o veículo que a massa grava", () => {
  const linhas = linhasDadosDaCategoria(["mudanca"], { empresa: "[TESTE QA] Mudanças Teste E687 Ltda", veiculo: "Caminhão baú de teste (sem placa real)" });
  assert.deepEqual(linhas.map((l) => l.valor), ["[TESTE QA] Mudanças Teste E687 Ltda", "Caminhão baú de teste (sem placa real)"]);
});

test("aplicar-0338 registra a versão e o rollback remove só as linhas a0329…", () => {
  assert.match(ler(APLICAR), /'20261111000338', '0338_qa_parceiro_mudanca_correcao_e687'/);
  const rb = ler("supabase/producao/rollback/0338_rollback.sql");
  for (const id of ["000000000012", "000000000011", "000000000010"]) assert.match(rb, new RegExp(`'a0329000-0000-4000-8000-${id}'`));
  assert.doesNotMatch(rb, /user_id|status/);
});
