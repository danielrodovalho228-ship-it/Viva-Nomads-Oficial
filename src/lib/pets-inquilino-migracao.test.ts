import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Ordem b884dfc9: a função do gatilho do limite de 3 pets tem de fixar o search_path.
const sql = (p: string) => readFileSync(p, "utf8");

test("0123 fixa o search_path da função pets_inquilino_limite", () => {
  const m = sql("supabase/migrations/0123_pets_limite_search_path.sql");
  assert.match(m, /create or replace function public\.pets_inquilino_limite\(\)/);
  assert.match(m, /set search_path = public/);
  assert.match(m, /Limite de 3 pets por conta/);
});

test("aplicar-0123 é idempotente, em transação e se registra", () => {
  const a = sql("supabase/producao/aplicar-0123.sql");
  assert.match(a, /^begin;/m);
  assert.match(a, /commit;\s*$/);
  assert.match(a, /set search_path = public/);
  assert.match(a, /20261014000123/);
  assert.match(a, /where not exists \(select 1 from supabase_migrations\.schema_migrations/);
});

test("rollback da 0123 só tira o search_path e o registro", () => {
  const r = sql("supabase/producao/rollback/0123_rollback.sql");
  assert.doesNotMatch(r, /drop table/i);
  assert.match(r, /delete from supabase_migrations\.schema_migrations where version = '20261014000123'/);
});
