import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Ordem 8302024d (a): marcas por usuário com RLS — um usuário nunca vê as marcas do outro.
const sql = (p: string) => readFileSync(p, "utf8");

test("0134: tabela com RLS que só deixa o dono da marca ler e gravar", () => {
  const m = sql("supabase/migrations/0134_imovel_marcas.sql");
  assert.match(m, /create table if not exists public\.imovel_marcas/);
  assert.match(m, /enable row level security/);
  for (const op of ["select", "insert", "update"]) assert.match(m, new RegExp(`for ${op} to authenticated`));
  assert.doesNotMatch(m, /for delete/);
  assert.doesNotMatch(m, /using \(true\)|with check \(true\)/);
  assert.match(m, /user_id = \(select auth\.uid\(\)\)/);
  assert.match(m, /revoke all on public\.imovel_marcas from anon/);
});

test("aplicar-0134 é idempotente, em transação e se registra", () => {
  const a = sql("supabase/producao/aplicar-0134.sql");
  assert.match(a, /^-- [^\n]*\n(?:--[^\n]*\n)*begin;/m);
  assert.match(a, /commit;\s*$/);
  assert.match(a, /20261016000134/);
  assert.match(a, /where not exists \(select 1 from supabase_migrations\.schema_migrations/);
  assert.match(a, /create table if not exists public\.imovel_marcas/);
});

test("rollback da 0134 só apaga a tabela das marcas e o registro", () => {
  const r = sql("supabase/producao/rollback/0134_rollback.sql");
  assert.match(r, /drop table if exists public\.imovel_marcas/);
  assert.match(r, /delete from supabase_migrations\.schema_migrations where version = '20261016000134'/);
});
