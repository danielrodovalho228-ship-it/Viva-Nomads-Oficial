/* Roda: node --test tests/migracoes/qa-documento-4a693a63-0289.test.ts — fixture da prova das 16:35 (04/11). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");
const sql = (s: string) => s.replace(/--[^\n]*/g, "");
const mig = sql(ler("supabase/migrations/0289_qa_documento_rascunho_4a693a63.sql"));
const aplRaw = ler("supabase/producao/aplicar-0289.sql");
const apl = sql(aplRaw);
const rb = ler("supabase/producao/rollback/0289_rollback.sql");

test("0289 (arquivo e aplicar): só a conta de teste do Paulo, só o rascunho 4a693a63, só a linha pendente", () => {
  for (const s of [mig, apl]) {
    assert.match(s, /lower\(email\) = 'proprietario2@vivanomads\.com\.br' and is_teste/);
    assert.match(s, /c_imovel constant uuid := '4a693a63-8f4e-453c-a888-cd0ea9ccc4ff'/);
    assert.match(s, /c_qualificacao constant uuid := '4f52b6aa-b9f8-4406-979b-6ee397bf10cf'/);
    assert.match(s, /status::text = 'draft'/);
    assert.match(s, /and document_status = 'pending'/);
    assert.match(s, /set document_status = 'approved',/);
    assert.match(s, /document_reviewed_by = v_revisor/);
    assert.match(s, /if v_revisor is null then/);
  }
});

test("0289: não publica, não mexe na negociação, na seed do D-5 nem em automações; um único update", () => {
  for (const s of [mig, apl]) {
    assert.equal((s.match(/\bupdate /g) ?? []).length, 1);
    assert.doesNotMatch(s, /update public\.properties|insert into public\.|delete from public/);
    assert.doesNotMatch(s, /negocia|monthly_price|published|VN-CT-D5D50247|AUTOMACOES/i);
  }
});

test("0289: aplicar entre begin/commit e registrado; rollback volta o documento a pendente e tira o registro", () => {
  assert.match(aplRaw, /^-- [^\n]*\n-- [^\n]*\nbegin;/);
  assert.match(aplRaw, /commit;\s*$/);
  assert.match(aplRaw, /'20261104000289', '0289_qa_documento_rascunho_4a693a63'[\s\S]*where not exists/);
  assert.match(rb, /set document_status = 'pending', document_review_reason = null, document_reviewed_at = null, document_reviewed_by = null/);
  assert.match(rb, /and document_status = 'approved';/);
  assert.match(rb, /delete from supabase_migrations\.schema_migrations where version = '20261104000289';/);
});
