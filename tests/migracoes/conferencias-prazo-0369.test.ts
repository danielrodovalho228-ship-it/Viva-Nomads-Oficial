/*
  Roda: node --test tests/migracoes/conferencias-prazo-0369.test.ts
  0369 (E1238, ORDENS-DUET 1207, 1231 e 1233): a coluna conferencias.prazo_em, onde congelarJanelaDeConferencia grava o
  prazo da janela de 48 h no momento em que a linha da conferência nasce. Só acrescenta a coluna (nula para as linhas
  que já existem: as já fechadas ficam como estão; as abertas sem prazo calculam pela regra). Só LÊ o texto: o
  complemento barato. A prova que afirma o comportamento é a EXECUTADA (tests/e2e/fixtures/prova-0369.ts).
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const sql = (s: string) => s.replace(/--[^\n]*/g, "").replace(/\s+/g, " ").trim();
const ler = (p: string) => (existsSync(p) ? sql(readFileSync(p, "utf8")) : "");
const MIG = ler("supabase/migrations/0369_conferencias_prazo_e1238.sql");
const APLICAR = ler("supabase/producao/aplicar-0369.sql");
const ROLLBACK = ler("supabase/producao/rollback/0369_rollback.sql");

test("0369: a coluna prazo_em (timestamptz, nula), idempotente, sem tocar em linha nenhuma", () => {
  for (const [nome, s] of Object.entries({ "migração": MIG, "aplicar-0369": APLICAR })) {
    assert.match(s, /alter table public\.conferencias add column if not exists prazo_em timestamptz;/, nome);
    assert.doesNotMatch(s, /update public\.conferencias|delete from public\.conferencias|not null/i, `${nome}: não mexe nas linhas`);
  }
});
test("aplicar-0369: transação curta e registo com o nome", () => {
  assert.match(APLICAR, /^begin; set local lock_timeout = '5s';[\s\S]*commit;$/);
  assert.match(APLICAR, /insert into supabase_migrations\.schema_migrations \(version, name\) select '20261127000369', '0369_conferencias_prazo_e1238' where not exists/);
});
test("rollback da 0369: tira a coluna e o registo, numa transação", () => {
  assert.match(ROLLBACK, /^begin;[\s\S]*commit;$/);
  assert.match(ROLLBACK, /alter table public\.conferencias drop column if exists prazo_em;/);
  assert.match(ROLLBACK, /delete from supabase_migrations\.schema_migrations where version = '20261127000369';/);
});
