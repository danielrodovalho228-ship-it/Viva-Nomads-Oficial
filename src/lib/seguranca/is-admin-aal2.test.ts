/*
  Ordem b1583238 (item 4): is_admin() exige aal2 quando a conta tem fator verificado.
  Estático (migração + aplicar + rollback). Roda: node --experimental-strip-types --test src/lib/seguranca/is-admin-aal2.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("0199: is_admin exige papel admin E (aal2 OU sem fator verificado)", () => {
  const mig = ler("supabase/migrations/0199_is_admin_aal2.sql");
  assert.match(mig, /role = 'admin'/);
  assert.match(mig, /auth\.jwt\(\) ->> 'aal'.*= 'aal2'/);
  assert.match(mig, /not exists \(\s*select 1 from auth\.mfa_factors[\s\S]*status = 'verified'/);
  assert.match(mig, /security definer/);
  assert.match(mig, /set search_path to 'public'/);
});

test("0199: aplicar idempotente entre begin/commit e registra a migração; rollback volta ao papel puro", () => {
  const ap = ler("supabase/producao/aplicar-0199.sql");
  assert.match(ap, /^begin;$/m);
  assert.match(ap, /^commit;$/m);
  assert.match(ap, /create or replace function public\.is_admin/);
  assert.match(ap, /0199_is_admin_aal2/);
  assert.match(ap, /where not exists \(select 1 from supabase_migrations\.schema_migrations where version = '20261021000199'\)/);
  const rb = ler("supabase/producao/rollback/0199_rollback.sql");
  assert.doesNotMatch(rb, /mfa_factors/);
  assert.match(rb, /delete from supabase_migrations\.schema_migrations where version = '20261021000199'/);
});
