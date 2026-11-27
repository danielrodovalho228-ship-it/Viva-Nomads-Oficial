/*
  Roda: node --test tests/migracoes/contrato-eventos-pagamento-anulado-0368.test.ts
  0368 (E1229, ORDENS-DUET 1160 e 1162): "pagamento_anulado" entra na lista fechada de tipos de contrato_eventos, com os
  12 tipos de antes (0225) intactos. Só LÊ o texto: o complemento barato. A prova que afirma o comportamento é a
  EXECUTADA, a t1799 (tests/e2e/fixtures/prova-0368.ts), num banco descartável.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = (s: string) => s.replace(/--[^\n]*/g, "").replace(/\s+/g, " ").trim();
const MIG = sql(readFileSync("supabase/migrations/0368_contrato_eventos_pagamento_anulado_e1229.sql", "utf8"));
const APLICAR = sql(readFileSync("supabase/producao/aplicar-0368.sql", "utf8"));
const ROLLBACK = sql(readFileSync("supabase/producao/rollback/0368_rollback.sql", "utf8"));
const ANTES = ["aditivo_proposto", "aditivo_aceito", "aditivo_recusado", "aditivo_expirado", "estadia_remarcada", "encerramento_pedido", "contrato_encerrado", "instrucoes_liberadas", "ocupantes_apagados", "convidado_adicionado", "convidado_removido", "convidados_apagados"];
const lista = (s: string) => [...(/contrato_eventos_tipo_check check \(tipo in \(([^)]*)\)\)/.exec(s)?.[1] ?? "").matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

test("0368: a lista nova = os 12 de antes + pagamento_anulado", () => {
  for (const [nome, s] of Object.entries({ "migração": MIG, "aplicar-0368": APLICAR })) assert.deepEqual(lista(s), [...ANTES, "pagamento_anulado"], nome);
});
test("rollback da 0368: a lista de antes, numa transação, sem apagar evento", () => {
  assert.match(ROLLBACK, /^begin;[\s\S]*commit;$/);
  assert.deepEqual(lista(ROLLBACK), ANTES);
  assert.doesNotMatch(ROLLBACK, /delete from public\.contrato_eventos|exception when/i);
  assert.match(ROLLBACK, /delete from supabase_migrations\.schema_migrations where version = '20261127000368';/);
});
test("aplicar-0368: transação curta e registo com o nome", () => {
  assert.match(APLICAR, /^begin; set local lock_timeout = '5s';[\s\S]*commit;$/);
  assert.match(APLICAR, /insert into supabase_migrations\.schema_migrations \(version, name\) select '20261127000368', '0368_contrato_eventos_pagamento_anulado_e1229' where not exists/);
});
