/*
  E721 — "[push] adiar 42P10": o upsert por (user_id, grupo) precisa de um índice único COMPLETO (o parcial da 0226 não serve
  de alvo do ON CONFLICT pelo cliente). Roda: node --test src/lib/notifications/e721-push-adiado-indice.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const semComentario = (s: string) => s.replace(/^\s*--.*$/gm, "");

test("o servidor agrupa por upsert em (user_id,grupo) e o banco passa a ter índice único completo nessas colunas", () => {
  assert.match(ler("src/lib/notifications/push-servidor.ts"), /upsert\(linha, \{ onConflict: "user_id,grupo" \}\)/);
  for (const f of ["supabase/migrations/0332_push_adiados_indice_unico_e721.sql", "supabase/producao/aplicar-0332.sql"]) {
    const sql = semComentario(ler(f));
    assert.match(sql, /create unique index if not exists push_adiados_user_grupo on public\.push_adiados \(user_id, grupo\);/);
    assert.doesNotMatch(sql, /create unique index[^;]*where/i); // sem predicado: é isso que o ON CONFLICT exige
    assert.match(sql, /drop index if exists public\.push_adiados_grupo;/);
    assert.doesNotMatch(sql, /\b(delete|update|insert\s+into)\s+(from\s+)?public\./i); // só índice, nenhum dado
  }
});

test("a 0226 tinha o índice parcial (a causa) e o aplicar-0332 registra a versão; o rollback volta ao parcial", () => {
  assert.match(ler("supabase/migrations/0226_push_matriz.sql"), /push_adiados_grupo on public\.push_adiados \(user_id, grupo\) where grupo is not null/);
  assert.match(ler("supabase/producao/aplicar-0332.sql"), /'20261107000332', '0332_push_adiados_indice_unico_e721'/);
  assert.match(ler("supabase/producao/rollback/0332_rollback.sql"), /where grupo is not null/);
});
