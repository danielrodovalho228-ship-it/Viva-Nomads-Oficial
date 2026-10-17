/*
  Estático: a migração 0143 (ordem 0f66a754, item 3) só cria índices nas chaves estrangeiras sem índice.
  Roda: node --experimental-strip-types --test src/lib/indices-fk-migracao.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const mig = ler("supabase/migrations/0143_indices_fk.sql");
const ap = ler("supabase/producao/aplicar-0143.sql");
const rb = ler("supabase/producao/rollback/0143_rollback.sql");

const criados = [...mig.matchAll(/^create index if not exists (\w+) on public\.(\w+) \((\w+)\);$/gm)];

test("0143: só cria índices (if not exists), sem mexer em dados, políticas ou permissões", () => {
  assert.ok(criados.length >= 80, `esperava os ~86 índices, achei ${criados.length}`);
  const semComentario = mig.replace(/^--.*$/gm, "");
  assert.doesNotMatch(semComentario, /\b(drop|delete|update|insert|alter|grant|revoke|truncate)\b/i);
  const linhasCreate = semComentario.split("\n").filter((l) => /^create /i.test(l));
  assert.equal(linhasCreate.length, criados.length, "toda linha create é um índice simples if not exists");
});

test("0143: nomes únicos e dentro do limite de 63 caracteres do Postgres", () => {
  const nomes = criados.map((m) => m[1]);
  assert.equal(new Set(nomes).size, nomes.length);
  for (const n of nomes) assert.ok(n.length <= 63, n);
});

test("0143: aplicar-0143 idempotente, begin/commit, registra em schema_migrations", () => {
  assert.match(ap, /^begin;$/m);
  assert.match(ap, /^commit;$/m);
  assert.match(ap, /'0143_indices_fk'/);
  assert.match(ap, /where not exists \(select 1 from supabase_migrations\.schema_migrations/);
  for (const m of criados) assert.ok(ap.includes(m[0]), `aplicar sem ${m[1]}`);
});

test("0143: rollback remove exatamente os índices criados e o registro", () => {
  for (const m of criados) assert.ok(rb.includes(`drop index if exists public.${m[1]};`), m[1]);
  assert.equal([...rb.matchAll(/^drop index/gm)].length, criados.length);
  assert.match(rb, /delete from supabase_migrations\.schema_migrations where version = '20261016000143'/);
});
