/*
  E657 (migração 0315, aprovada pelo Daniel) — "Enviada em" da lista de candidaturas mostrava a data de CRIAÇÃO do lead, mesmo quando
  a candidatura foi REENVIADA depois (E581 atualiza período/motivo/pessoas, mas `created_at` não muda): enviada em 06/11, aparecia
  04/11. Agora `leads.reenviada_em` guarda o reenvio e a lista mostra `reenviada_em ?? created_at`.
  Roda: node --test src/lib/data/e657-reenvio-candidatura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const NOME = "0315_candidatura_reenviada_em_e657";

test("migração: coluna aditiva, leitura liberada ao usuário, aplicar idempotente com registro e rollback", () => {
  assert.ok(existsSync(new URL(`../../../supabase/migrations/${NOME}.sql`, import.meta.url)));
  const m = ler(`supabase/migrations/${NOME}.sql`);
  assert.match(m, /alter table public\.leads\s+add column if not exists reenviada_em timestamptz;/);
  assert.match(m, /grant select \(reenviada_em\) on public\.leads to authenticated;/);
  const a = ler("supabase/producao/aplicar-0315.sql");
  assert.match(a, /^begin;/m);
  assert.match(a, /commit;\s*$/);
  assert.match(a, /add column if not exists reenviada_em timestamptz/);
  assert.match(a, new RegExp(`'${NOME}'`));
  assert.match(a, /where not exists \(select 1 from supabase_migrations\.schema_migrations where version = '20261107000315'\)/);
  const r = ler("supabase/producao/rollback/0315_rollback.sql");
  assert.match(r, /drop column if exists reenviada_em/);
  assert.match(r, /delete from supabase_migrations\.schema_migrations where version = '20261107000315'/);
});

test("a candidatura repetida grava o reenvio", () => {
  const src = ler("src/lib/data/actions.ts");
  const i = src.indexOf("E581: candidatura repetida");
  assert.ok(i > 0);
  const trecho = src.slice(i, i + 1500);
  assert.match(trecho, /\.update\(\{ \.\.\.campos, reenviada_em: new Date\(\)\.toISOString\(\) \}\)/);
});

test("a lista do morador mostra o reenvio quando houver (senão a criação)", () => {
  const src = ler("src/lib/data/leads-actions.ts");
  assert.match(src, /id, status, owner_id, property_id, created_at, reenviada_em,/);
  assert.match(src, /\.\.\.envioDaCandidatura\(r\.created_at, r\.reenviada_em\),/); // a regra única: reenviada_em ?? created_at (src/lib/candidaturas-envio.ts)
  const pg = ler("src/app/(dashboard)/dashboard/candidaturas/page.tsx");
  assert.match(pg, /Enviada em \{dataBRT\(c\.enviadaEm\)\}/);
});
