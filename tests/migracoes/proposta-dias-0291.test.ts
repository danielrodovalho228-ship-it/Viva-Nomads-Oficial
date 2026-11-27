/* Roda: node --test tests/migracoes/proposta-dias-0291.test.ts — E562 (E-DIAS): proposta em dias exatos. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");
const sql = (s: string) => s.replace(/--[^\n]*/g, "");
const aplRaw = ler("supabase/producao/aplicar-0291.sql");

test("0291 (arquivo e aplicar): dias com check, backfill meses × 30, meses derivado e pacote de limpezas", () => {
  for (const s of [sql(ler("supabase/migrations/0291_proposta_versoes_dias.sql")), sql(aplRaw)]) {
    assert.match(s, /add column if not exists dias integer;/);
    assert.match(s, /add column if not exists limpezas_pacote integer;/);
    assert.match(s, /update public\.proposta_versoes set dias = meses \* 30 where dias is null;/);
    assert.match(s, /new\.meses := ceil\(new\.dias \/ 30\.0\)::integer;/);
    assert.match(s, /check \(dias between 30 and 180 and meses = ceil\(dias \/ 30\.0\)::integer\)/);
    assert.match(s, /check \(limpezas_pacote is null or limpezas_pacote between 0 and 48\)/);
    assert.match(s, /alter column dias set not null;/);
    assert.match(s, /set search_path = ''/);
    // Só a proposta_versoes: nada de contratos, blocos, variáveis ou contas.
    assert.doesNotMatch(s, /contratos|contrato_blocos|AUTOMACOES|ADMIN_2FA|VN-CT-D5D50247|auth\./i);
  }
});

test("0291: aplicar entre begin/commit e registrado; rollback tira gatilho, checks, colunas e o registro", () => {
  assert.match(aplRaw, /^-- [^\n]*\n-- [^\n]*\nbegin;/);
  assert.match(aplRaw, /commit;\s*$/);
  assert.match(aplRaw, /'20261104000291', '0291_proposta_versoes_dias'[\s\S]*where not exists/);
  const rb = sql(ler("supabase/producao/rollback/0291_rollback.sql"));
  assert.match(rb, /drop trigger if exists proposta_versoes_dias/);
  assert.match(rb, /drop column if exists dias;/);
  assert.match(rb, /delete from supabase_migrations\.schema_migrations where version = '20261104000291';/);
});
