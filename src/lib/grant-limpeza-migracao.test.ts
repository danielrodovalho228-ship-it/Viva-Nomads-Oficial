/*
  Estático: a 0147 concede o SELECT público de properties.limpeza_estadia (a 0144 criou a coluna sem o grant e o
  anúncio lia NULL). Roda: node --experimental-strip-types --test src/lib/grant-limpeza-migracao.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const semComentario = (s: string) => s.replace(/^--.*$/gm, "");
const mig = ler("supabase/migrations/0147_grant_limpeza_estadia.sql");
const ap = ler("supabase/producao/aplicar-0147.sql");
const rb = ler("supabase/producao/rollback/0147_rollback.sql");

test("0147: só o grant de limpeza_estadia, sem tocar em endereço", () => {
  const sql = semComentario(mig);
  assert.match(sql, /grant select \(limpeza_estadia\) on public\.properties to anon, authenticated;/);
  assert.doesNotMatch(sql, /exact_address|lat_exata|lng_exata|drop |alter table/i);
});

test("0147: aplicar idempotente, begin/commit, registra em schema_migrations, com rollback", () => {
  assert.match(ap, /^begin;$/m);
  assert.match(ap, /^commit;$/m);
  assert.match(ap, /grant select \(limpeza_estadia\) on public\.properties to anon, authenticated;/);
  assert.match(ap, /'0147_grant_limpeza_estadia'/);
  assert.match(ap, /where not exists/);
  assert.match(semComentario(rb), /revoke select \(limpeza_estadia\) on public\.properties from anon, authenticated;/);
  assert.match(rb, /delete from supabase_migrations\.schema_migrations where version = '20261017000147'/);
});
