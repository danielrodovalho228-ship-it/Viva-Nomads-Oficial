import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Ordem ab50d8af: imóvel administrado (managed) só publica com o tipo do documento (contrato de gestão ou procuração).
const sql = readFileSync("supabase/migrations/0234_tipo_documento_operacao.sql", "utf8");

test("0234: gatilho recusa publicar managed sem contrato_gestao/procuracao e dispara quando o tipo muda", () => {
  assert.match(sql, /new\.ownership_type::text = 'managed'\s+and coalesce\(new\.sublease_doc_tipo, ''\) not in \('contrato_gestao', 'procuracao'\)/);
  assert.match(sql, /before insert or update of status, ownership_type, sublease_authorized, sublease_doc_url, sublease_doc_tipo/);
  assert.match(sql, /check \(sublease_doc_tipo is null or sublease_doc_tipo in \('autorizacao', 'contrato_gestao', 'procuracao'\)\)/);
});

test("0234: a regra antiga da 0091 continua (declaração + arquivo na pasta do dono) e anon não lê o tipo", () => {
  assert.match(sql, /new\.sublease_doc_url !~ \('\^' \|\| new\.owner_id::text \|\| '\/\[\^\/\]\+\$'\)/);
  assert.match(sql, /grant select \(sublease_doc_tipo\) on public\.properties to authenticated;/);
  assert.doesNotMatch(sql, /to anon/i);
});

test("0234: aplicar e rollback existem, se registram com o mesmo nome e o aplicar repete a função", () => {
  const aplicar = readFileSync("supabase/producao/aplicar-0234.sql", "utf8");
  assert.match(aplicar, /'20261024000234', '0234_tipo_documento_operacao'/);
  assert.match(readFileSync("supabase/producao/rollback/0234_rollback.sql", "utf8"), /version = '20261024000234'/);
  assert.ok(aplicar.includes(sql.slice(sql.indexOf("create or replace function"), sql.indexOf("revoke all")).trim()));
  assert.match(aplicar, /^-- .*\nbegin;/);
  assert.match(aplicar, /commit;\s*$/);
});
