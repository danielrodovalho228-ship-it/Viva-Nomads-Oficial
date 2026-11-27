/*
  Roda: node --test tests/migracoes/retorno-unico-0347.test.ts
  E1032 (ORDEM-DUET-171, 19/11/2026): agentes_conversas ganha `retorno_da_ordem` com índice único parcial. É o banco que
  garante que o "Retorno" de uma ordem do Moacir entra uma vez só, mesmo com a Central desenhada duas vezes ao mesmo
  tempo. As linhas que já existem ficam com a coluna nula: nenhuma é regravada, e o índice nunca falha por causa delas.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const sql = (s: string) => s.replace(/--[^\n]*/g, "");
const MIG = "supabase/migrations/0347_agentes_conversas_retorno_unico_e1032.sql";
const APLICAR = "supabase/producao/aplicar-0347.sql";
const ROLLBACK = "supabase/producao/rollback/0347_rollback.sql";

test("0347: coluna nula por omissão e índice único parcial", () => {
  const m = sql(readFileSync(MIG, "utf8"));
  assert.match(m, /alter table public\.agentes_conversas add column if not exists retorno_da_ordem uuid;/);
  assert.match(m, /create unique index if not exists agentes_conversas_retorno_unico\s+on public\.agentes_conversas \(retorno_da_ordem\)\s+where retorno_da_ordem is not null;/);
  assert.doesNotMatch(m, /\bupdate\s+public\.agentes_conversas\b/i, "não regrava linha existente");
  assert.doesNotMatch(m, /\bdelete\s+from\b/i, "não apaga nada");
});

test("aplicar-0347: idempotente, numa transação, e regista-se com o nome da migração", () => {
  const a = sql(readFileSync(APLICAR, "utf8"));
  assert.match(a.trim(), /^begin;[\s\S]*commit;$/);
  assert.match(a, /set local lock_timeout = '5s';/);
  assert.match(a, /add column retorno_da_ordem uuid/);
  assert.match(a, /if not exists \(\s*select 1 from information_schema\.columns/);
  assert.match(a, /create unique index if not exists agentes_conversas_retorno_unico/);
  assert.match(a, /insert into supabase_migrations\.schema_migrations \(version, name\)\s+select '20261119000347', '0347_agentes_conversas_retorno_unico_e1032'\s+where not exists/);
  assert.doesNotMatch(a, /\bupdate\s+public\.agentes_conversas\b/i);
  assert.doesNotMatch(a, /\bdelete\s+from\s+public\./i);
});

test("rollback da 0347: tira o índice e a coluna e apaga o registo", () => {
  assert.ok(existsSync(ROLLBACK));
  const r = sql(readFileSync(ROLLBACK, "utf8"));
  assert.match(r.trim(), /^begin;[\s\S]*commit;$/);
  assert.match(r, /drop index if exists public\.agentes_conversas_retorno_unico;/);
  assert.match(r, /alter table public\.agentes_conversas drop column if exists retorno_da_ordem;/);
  assert.match(r, /delete from supabase_migrations\.schema_migrations where version = '20261119000347';/);
});
