import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/migrations/0248_vinculo_profissional.sql", "utf8");

test("0248: RLS ligada, sem política e sem acesso de anon/authenticated", () => {
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on public\.vinculo_profissional from anon, authenticated/);
  assert.doesNotMatch(sql, /create policy/i);
});

test("0248: guarda só domínio e hash, nunca o e-mail nem o código", () => {
  assert.match(sql, /codigo_hash text not null/);
  assert.doesNotMatch(sql, /\bemail\b\s+text/i);
  assert.doesNotMatch(sql, /\bcodigo\s+text/i);
});

test("0248: aplicar/rollback existem e o aplicar é idempotente e registrado", () => {
  const ap = readFileSync("supabase/producao/aplicar-0248.sql", "utf8");
  assert.match(ap, /^begin;/m);
  assert.match(ap, /create table if not exists public\.vinculo_profissional/);
  assert.match(ap, /'0248_vinculo_profissional'/);
  assert.match(ap, /commit;\s*$/);
  const rb = readFileSync("supabase/producao/rollback/0248_rollback.sql", "utf8");
  assert.match(rb, /drop table if exists public\.vinculo_profissional/);
});
