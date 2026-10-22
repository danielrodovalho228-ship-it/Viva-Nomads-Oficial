import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Ordem 3c3d8a9e, parte 1: a migração 0207 precisa manter as garantias do aceite do sócio.
const sql = readFileSync("supabase/migrations/0207_aceite_socio.sql", "utf8");

test("0207: novo status, gatilho do autor e Moacir sem 'feito' direto", () => {
  assert.match(sql, /'aguardando_aceite'/);
  assert.match(sql, /auth\.uid\(\) is distinct from old\.autor/); // só o autor tira o item de aguardando_aceite
  assert.match(sql, /if v_status = 'feito' then v_status := 'aguardando_aceite'/);
  assert.match(sql, /grant execute on function public\.responder_caixa_socios\(uuid, text, text, uuid\) to service_role/);
  assert.doesNotMatch(sql, /to (anon|authenticated)\b/);
});

test("0207: aplicar e rollback existem e se registram com o mesmo nome", () => {
  const aplicar = readFileSync("supabase/producao/aplicar-0207.sql", "utf8");
  assert.match(aplicar, /'20261022000207', '0207_aceite_socio'/);
  assert.match(readFileSync("supabase/producao/rollback/0207_rollback.sql", "utf8"), /version = '20261022000207'/);
});
