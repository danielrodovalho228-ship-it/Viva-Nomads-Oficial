/*
  Estático: a migração 0138 tira o privilégio padrão do anônimo na caixa de e-mails de teste
  (ordem 14b71433). A RLS já barra; o revoke tira também o privilégio de tabela.
  Roda: node --experimental-strip-types --test src/lib/emails-teste-anon-migracao.test.ts
*/
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const caminho = (p: string) => new URL(`../../${p}`, import.meta.url);
const ler = (p: string) => readFileSync(caminho(p), "utf8");

test("0138: revoke de tudo em emails_teste para anon, sem tocar nas políticas", () => {
  for (const p of ["supabase/migrations/0138_emails_teste_sem_anon.sql", "supabase/producao/aplicar-0138.sql"]) {
    assert.ok(existsSync(caminho(p)), `${p} existe`);
    const sql = ler(p);
    assert.match(sql, /revoke all on public\.emails_teste from anon;/);
    assert.doesNotMatch(sql, /grant /i); // nunca concede nada
    assert.doesNotMatch(sql, /drop table/i);
  }
});

test("0138: aplicar idempotente, com begin/commit, registro e rollback", () => {
  const ap = ler("supabase/producao/aplicar-0138.sql");
  assert.match(ap, /^begin;$/m);
  assert.match(ap, /^commit;$/m);
  assert.match(ap, /'0138_emails_teste_sem_anon'/);
  assert.match(ap, /where not exists \(select 1 from supabase_migrations\.schema_migrations where version = '20261016000138'\)/);
  const rb = ler("supabase/producao/rollback/0138_rollback.sql");
  assert.match(rb, /grant select on public\.emails_teste to anon;/);
  assert.match(rb, /delete from supabase_migrations\.schema_migrations where version = '20261016000138'/);
});

test("0138: não há dado pessoal na migração", () => {
  assert.doesNotMatch(ler("supabase/migrations/0138_emails_teste_sem_anon.sql"), /@[a-z0-9-]+\.[a-z]{2,}/i);
});
