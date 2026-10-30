/* Roda: node --test tests/migracoes/qa-intencao-ana-0265.test.ts — 0265 (QA, E283-B): só a intenção da Ana, só conta de teste. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mig = readFileSync("supabase/migrations/0265_qa_zera_intencao_ana.sql", "utf8");
const apl = readFileSync("supabase/producao/aplicar-0265.sql", "utf8");
const rb = readFileSync("supabase/producao/rollback/0265_rollback.sql", "utf8");
const sql = (s: string) => s.replace(/--[^\n]*/g, "");

test("0265: zera SÓ profiles.intencao da Ana (id + e-mail + is_teste), nada mais", () => {
  for (const s of [sql(mig), sql(apl)]) {
    assert.match(s, /update public\.profiles\s+set intencao = null\s+where id = '3555816b-7100-4301-94a4-aec9eeccf991'\s+and email = 'inquilino2@vivanomads\.com\.br'\s+and is_teste is true;/);
    assert.doesNotMatch(s, /papel_ativo|preferred_mode|role|delete from public|automacoes_envios|properties/);
    assert.equal((s.match(/update /g) ?? []).length, 1);
  }
});

test("0265: aplicar entre begin/commit, registrado com o nome da migração; rollback devolve 'anunciar' só se ainda vazia", () => {
  assert.match(apl, /^-- [^\n]*\nbegin;/);
  assert.match(apl, /commit;\s*$/);
  assert.match(apl, /'20261030000265', '0265_qa_zera_intencao_ana'[\s\S]*where not exists/);
  assert.match(rb, /set intencao = array\['anunciar'\]::text\[\][\s\S]*and intencao is null;/);
  assert.match(rb, /delete from supabase_migrations\.schema_migrations where version = '20261030000265';/);
});
