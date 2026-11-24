/*
  E690 — massa: o avaliador de teste UDI-002 passa de em_teste a ativo (decisão do coordenador, 08/11), só conta is_teste,
  só com a avaliação de teste concluída. Roda: node --test src/lib/qa/massa-avaliador-udi002-ativo-e690.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

for (const arquivo of ["supabase/migrations/0331_qa_avaliador_udi002_ativo_e690.sql", "supabase/producao/aplicar-0331.sql"]) {
  test(`${arquivo}: só UDI-002, só em_teste, só conta de teste e com a avaliação de teste concluída`, () => {
    const sql = ler(arquivo).replace(/^\s*--.*$/gm, "");
    assert.match(sql, /numero_credenciado = 'UDI-002'/);
    assert.match(sql, /a\.status = 'em_teste'/);
    assert.match(sql, /u\.is_teste/);
    assert.match(sql, /v\.teste and v\.status = 'laudo_emitido'/);
    assert.match(sql, /set status = 'ativo'/);
    assert.match(sql, /where id = v_id and status = 'em_teste'/);
    assert.match(sql, /nada a fazer/); // idempotente
    // Registro honesto: nenhum admin decidiu.
    assert.doesNotMatch(sql, /decidido_por\s*=/);
    assert.match(sql, /Massa de teste E690/);
    // Não toca em UDI-001, em chaves nem em outras tabelas.
    assert.doesNotMatch(sql, /UDI-001|AUTOMACOES_ATIVO|VISTORIA_ATIVA|chaves_plataforma/);
    assert.equal((sql.match(/\bupdate\s+public\./gi) ?? []).length, 1);
    assert.doesNotMatch(sql, /\b(delete|insert)\s+(from\s+|into\s+)public\./i);
  });
}

test("aplicar-0331 registra a versão 20261107000331 entre begin/commit; o rollback só desfaz o que a própria 0331 fez", () => {
  const a = ler("supabase/producao/aplicar-0331.sql");
  assert.match(a, /^begin;/m);
  assert.match(a, /commit;\s*$/);
  assert.match(a, /'20261107000331', '0331_qa_avaliador_udi002_ativo_e690'/);
  const r = ler("supabase/producao/rollback/0331_rollback.sql");
  assert.match(r, /motivo like 'Massa de teste E690:%'/);
  assert.match(r, /status = 'em_teste'/);
});
