/*
  E872 (decisão do Daniel, 13/11/2026): a tabela de backup public._bkp_0176_contratos_encerrados fica PROTEGIDA (RLS
  ligado, sem política) e NUNCA é apagada — nem pela 0343, nem pelo aplicar, nem pelo rollback dela.
  Roda: node --test tests/migracoes/e872-rls-bkp-0176.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const MIG = ler("supabase/migrations/0343_rls_bkp_0176.sql");
const APLICAR = ler("supabase/producao/aplicar-0343.sql");
const ROLLBACK = ler("supabase/producao/rollback/0343_rollback.sql");
const sem = (s: string) => s.replace(/--.*$/gm, ""); // só o SQL, sem comentários

test("a 0343 liga o RLS na tabela de backup e não cria política (só service_role/dono leem)", () => {
  for (const s of [MIG, APLICAR]) {
    assert.match(sem(s), /alter table if exists public\._bkp_0176_contratos_encerrados enable row level security;/);
    assert.match(sem(s), /revoke all on table public\._bkp_0176_contratos_encerrados from anon, authenticated;/);
    assert.doesNotMatch(sem(s), /create policy/i);
  }
});

test("nada apaga a tabela nem as linhas dela (0343, aplicar e rollback)", () => {
  for (const s of [MIG, APLICAR, ROLLBACK]) {
    assert.doesNotMatch(sem(s), /drop\s+table/i);
    assert.doesNotMatch(sem(s), /truncate/i);
    assert.doesNotMatch(sem(s), /delete\s+from\s+public\._bkp_0176/i);
  }
  assert.match(sem(ROLLBACK), /disable row level security;/);
  // O rollback da 0176 também não apaga mais a tabela (ele ainda devolve o status dos contratos a partir dela).
  const rb0176 = sem(ler("supabase/producao/rollback/0176_rollback.sql"));
  assert.doesNotMatch(rb0176, /drop\s+table[^;]*_bkp_0176/i);
  assert.match(rb0176, /from public\._bkp_0176_contratos_encerrados b where b\.id = c\.id/);
});

test("o aplicar segue a regra da casa: transação, idempotente e registrado como 0343_rls_bkp_0176", () => {
  const sql = sem(APLICAR);
  assert.match(sql, /^\s*begin;/m);
  assert.match(sql, /commit;\s*$/);
  assert.match(sql, /insert into supabase_migrations\.schema_migrations \(version, name\)\s*select '20261113000343', '0343_rls_bkp_0176'\s*where not exists/);
  assert.match(sql, /to_regclass\('public\._bkp_0176_contratos_encerrados'\) is not null/);
});
