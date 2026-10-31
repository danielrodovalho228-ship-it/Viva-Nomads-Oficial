/* Roda: node --test tests/migracoes/qa-tipo-entrada-0267.test.ts — L-79: a massa da 0264 traz draft_data.tipoEntrada. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tipoEntradaValido } from "../../src/lib/anuncio/chegada-e-pedido.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const sql = (s: string) => s.replace(/--[^\n]*/g, "");
const dadosDaMassa = (s: string) => s.slice(s.indexOf("v_dados := jsonb_build_object("), s.indexOf("insert into public.properties"));

test("0264 (arquivo e aplicar): o rascunho grava a resposta do Passo 6 (tipoEntrada) com uma chave válida", () => {
  for (const p of ["supabase/migrations/0264_qa_rascunhos_publicaveis.sql", "supabase/producao/aplicar-0264.sql"]) {
    const m = /'tipoEntrada',\s*'([a-z_]+)'/.exec(sql(dadosDaMassa(ler(p))));
    assert.ok(m, p);
    assert.ok(tipoEntradaValido(m![1]), `${p}: ${m![1]}`);
  }
  assert.match(ler("docs/qa-receita-rascunho-publicavel.md"), /`tipoEntrada` \(a resposta do Passo 6/);
});

test("0267: só os dois rascunhos de teste da 0264, só se faltar o campo; aplicar registrado; rollback tira o campo", () => {
  const mig = sql(ler("supabase/migrations/0267_qa_tipo_entrada_0264.sql"));
  const apl = ler("supabase/producao/aplicar-0267.sql");
  const rb = ler("supabase/producao/rollback/0267_rollback.sql");
  for (const s of [mig, sql(apl)]) {
    assert.match(s, /set draft_data = coalesce\(p\.draft_data, '\{\}'::jsonb\) \|\| jsonb_build_object\('tipoEntrada', 'porteiro'\)/);
    assert.match(s, /p\.id in \('a0264a00-0000-4000-8000-000000000001', 'a0264b00-0000-4000-8000-000000000001'\)/);
    assert.match(s, /p\.status::text = 'draft'/);
    assert.match(s, /not coalesce\(p\.draft_data \? 'tipoEntrada', false\)/);
    assert.match(s, /d\.is_teste\)/);
    assert.equal((s.match(/\bupdate /g) ?? []).length, 1);
    assert.doesNotMatch(s, /delete from public|insert into public\./);
  }
  assert.match(apl, /^-- [^\n]*\nbegin;/);
  assert.match(apl, /commit;\s*$/);
  assert.match(apl, /'20261031000267', '0267_qa_tipo_entrada_0264'[\s\S]*where not exists/);
  assert.match(rb, /set draft_data = p\.draft_data - 'tipoEntrada'/);
  assert.match(rb, /delete from supabase_migrations\.schema_migrations where version = '20261031000267';/);
});
