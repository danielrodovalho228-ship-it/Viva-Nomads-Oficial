/*
  0272 — desfaz as massas 0270 (E274) e 0271 (E289 grupo 2), mescladas depois de o Muse revogar as duas decisões.
  Roda: node --test src/lib/qa/desfaz-0270-0271.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("0272: tira a visita de teste, o cartão não enviado e volta o anúncio C a rascunho; só ids das massas", () => {
  for (const sql of [ler("supabase/migrations/0272_qa_desfaz_0270_0271.sql"), ler("supabase/producao/aplicar-0272.sql")]) {
    assert.match(sql, /delete from public\.vistoria_pedidos where id = 'a0271000-0000-4000-8000-000000000001';/);
    assert.match(sql, /evento = 'pedido_imovel_novo' and ref_id = c_imovel and enviado_em is null;/);
    assert.match(sql, /set status = 'draft',\s+draft_data = jsonb_build_object\(/);
    assert.match(sql, /where id = c_imovel and status = 'active';/);
    assert.match(sql, /'title', '\[TESTE QA\] Proativo E274 C'/);
    const codigo = sql.replace(/--[^\n]*/g, "");
    assert.doesNotMatch(codigo, /d5d50247|automacoes|vistoria_ativa|schema_migrations where version = '2026103100027[01]'/i);
  }
  const aplicar = ler("supabase/producao/aplicar-0272.sql");
  assert.match(aplicar, /^begin;$/m);
  assert.match(aplicar, /^commit;$/m);
  assert.match(aplicar, /'20261031000272', '0272_qa_desfaz_0270_0271'/);
});
