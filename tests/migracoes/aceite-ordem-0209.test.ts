import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Ordem 3c3d8a9e, parte 2: a migração 0209 precisa manter as garantias do aceite nas ordens dos agentes.
const sql = readFileSync("supabase/migrations/0209_aceite_ordem_agente.sql", "utf8");

test("0209: só o criador mexe no aceite e o backfill roda só na 1ª aplicação", () => {
  assert.match(sql, /auth\.uid\(\) is distinct from old\.criado_por/);
  assert.match(sql, /if not exists \([\s\S]*column_name = 'aceito_em'[\s\S]*\) then\s+alter table public\.agentes_ordens add column aceito_em/);
  assert.doesNotMatch(sql, /to (anon|authenticated)\b/);
});

test("0209: aplicar e rollback existem e se registram com o mesmo nome", () => {
  assert.match(readFileSync("supabase/producao/aplicar-0209.sql", "utf8"), /'20261022000209', '0209_aceite_ordem_agente'/);
  assert.match(readFileSync("supabase/producao/rollback/0209_rollback.sql", "utf8"), /version = '20261022000209'/);
});
