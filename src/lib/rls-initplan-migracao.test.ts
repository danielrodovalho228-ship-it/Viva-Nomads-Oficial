/*
  Estático: a migração 0132 (ordem 0f66a754, item 3) só embrulha auth.uid()/role()/jwt() em (select ...).
  Roda: node --experimental-strip-types --test src/lib/rls-initplan-migracao.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const mig = ler("supabase/migrations/0132_rls_initplan.sql");
const ap = ler("supabase/producao/aplicar-0132.sql");

test("0132: só políticas de public, só o que ainda não está embrulhado, sem apagar nem criar política", () => {
  assert.match(mig, /schemaname = 'public'/);
  assert.match(mig, /\(\?<!select \)/);
  assert.match(mig, /'\(select \\1\)'/);
  assert.match(mig, /alter policy/);
  assert.doesNotMatch(mig, /drop policy|create policy|disable row level security/i);
});

test("0132: aplicar-0132 idempotente, begin/commit, registra em schema_migrations e tem rollback", () => {
  assert.match(ap, /^begin;$/m);
  assert.match(ap, /^commit;$/m);
  assert.match(ap, /'0132_rls_initplan'/);
  assert.match(ap, /where not exists \(select 1 from supabase_migrations\.schema_migrations/);
  assert.ok(ap.includes(mig.slice(mig.indexOf("do $$"))), "o bloco do aplicar é o mesmo da migração");
  const rb = ler("supabase/producao/rollback/0132_rollback.sql");
  assert.match(rb, /alter policy/);
  assert.match(rb, /delete from supabase_migrations\.schema_migrations where version = '20261015000132'/);
});
