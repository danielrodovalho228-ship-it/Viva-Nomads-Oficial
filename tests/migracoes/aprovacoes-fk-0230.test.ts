import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Ordem 02afa253: a 0230 deixa o ON DELETE SET NULL de decidido_por passar pelo gatilho de imutabilidade.
const sql = readFileSync("supabase/migrations/0230_aprovacoes_fk_decidido_por.sql", "utf8");

test("0230: só decidido_por → null passa numa linha decidida; o resto continua recusado", () => {
  assert.match(sql, /old\.decidido_por is not null\s+and new\.decidido_por is null/);
  assert.match(sql, /\(to_jsonb\(new\) - 'decidido_por'\) = \(to_jsonb\(old\) - 'decidido_por'\)/);
  assert.match(sql, /raise exception 'aprovação já decidida não pode mudar'/);
  assert.match(sql, /tg_op = 'DELETE'[\s\S]*raise exception 'aprovacoes é um registro imutável'/);
  assert.doesNotMatch(sql, /\bdrop\b/i);
  assert.doesNotMatch(sql, /to (anon|authenticated)\b/);
});

test("0230: aplicar e rollback existem e se registram com o mesmo nome", () => {
  assert.match(readFileSync("supabase/producao/aplicar-0230.sql", "utf8"), /'20261023000230', '0230_aprovacoes_fk_decidido_por'/);
  assert.match(readFileSync("supabase/producao/rollback/0230_rollback.sql", "utf8"), /version = '20261023000230'/);
  const aplicar = readFileSync("supabase/producao/aplicar-0230.sql", "utf8");
  assert.ok(aplicar.includes(sql.slice(sql.indexOf("create or replace function"), sql.indexOf("revoke all")).trim()), "aplicar-0230 repete a função da migração");
});
