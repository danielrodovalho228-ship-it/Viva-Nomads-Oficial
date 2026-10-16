import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Ordem 4c74ac38, item 3: coluna do pacote de limpeza durante a estadia.
const sql = (p: string) => readFileSync(p, "utf8");

test("0144 só adiciona a coluna anulável limpeza_estadia", () => {
  const m = sql("supabase/migrations/0144_limpeza_estadia.sql");
  assert.match(m, /alter table public\.properties add column if not exists limpeza_estadia jsonb;/);
  assert.doesNotMatch(m, /drop |delete |update /i);
});

test("aplicar-0144 é idempotente, em transação e se registra", () => {
  const a = sql("supabase/producao/aplicar-0144.sql");
  assert.match(a, /^begin;/m);
  assert.match(a, /commit;\s*$/);
  assert.match(a, /add column if not exists limpeza_estadia jsonb/);
  assert.match(a, /20261016000144/);
  assert.match(a, /0144_limpeza_estadia/);
  assert.match(a, /where not exists \(select 1 from supabase_migrations\.schema_migrations/);
});

test("rollback da 0144 só remove a coluna e o registro", () => {
  const r = sql("supabase/producao/rollback/0144_rollback.sql");
  assert.match(r, /drop column if exists limpeza_estadia/);
  assert.doesNotMatch(r, /drop table/i);
  assert.match(r, /delete from supabase_migrations\.schema_migrations where version = '20261016000144'/);
});
