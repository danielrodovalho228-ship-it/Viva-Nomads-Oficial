/* Roda: node --test tests/migracoes/qa-proprietario1-fator-0290.test.ts — E256-B: porta de QA e o fator legado. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");
const sql = (s: string) => s.replace(/--[^\n]*/g, "");
const aplRaw = ler("supabase/producao/aplicar-0290.sql");

test("0290 (arquivo e aplicar): só a conta de teste proprietario1, nunca o admin observador", () => {
  for (const s of [sql(ler("supabase/migrations/0290_qa_proprietario1_sem_fator_legado.sql")), sql(aplRaw)]) {
    assert.match(s, /lower\(email\) = 'proprietario1@vivanomads\.com\.br' and is_teste = true and coalesce\(qa_admin, false\) = false/);
    assert.match(s, /delete from auth\.mfa_factors where user_id = v_conta;/);
    assert.equal((s.match(/\bdelete from /g) ?? []).length, 1);
    assert.doesNotMatch(s, /update |insert into public\.|ADMIN_2FA|AUTOMACOES|VN-CT-D5D50247/i);
  }
});

test("0290: aplicar entre begin/commit e registrado; rollback só tira o registro", () => {
  assert.match(aplRaw, /^-- [^\n]*\n-- [^\n]*\nbegin;/);
  assert.match(aplRaw, /commit;\s*$/);
  assert.match(aplRaw, /'20261104000290', '0290_qa_proprietario1_sem_fator_legado'[\s\S]*where not exists/);
  const rb = ler("supabase/producao/rollback/0290_rollback.sql");
  assert.match(rb, /delete from supabase_migrations\.schema_migrations where version = '20261104000290';/);
  assert.doesNotMatch(sql(rb), /mfa_factors/);
});
