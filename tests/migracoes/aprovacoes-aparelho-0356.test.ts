import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

// Ordem 12a8086d, item 4: a aprovação guarda de qual aparelho veio a decisão (resumo curto, sem IP).
const MIG = "supabase/migrations/0356_aprovacoes_decidido_aparelho.sql";

test("0356: coluna opcional, curta e idempotente; sem drop e sem grant para o navegador", () => {
  assert.ok(existsSync(MIG), "falta a migração 0356");
  const sql = readFileSync(MIG, "utf8");
  assert.match(sql, /add column if not exists decidido_aparelho text/);
  // ORDEM-DUET-558: a expressão fica ancorada no parêntese que fecha o check. Sem a âncora, `<= 600` passava.
  assert.match(sql, /char_length\(decidido_aparelho\) <= 60\)/);
  assert.doesNotMatch(sql, /\bdrop\b/i);
  assert.doesNotMatch(sql, /\bgrant\b/i);
});

test("0356: aplicar (begin/commit, registra o nome) e rollback existem", () => {
  const aplicar = readFileSync("supabase/producao/aplicar-0356.sql", "utf8");
  assert.match(aplicar, /^begin;/m);
  assert.match(aplicar, /^commit;/m);
  assert.match(aplicar, /add column if not exists decidido_aparelho text/);
  // O script que roda em produção leva o MESMO limite, também ancorado.
  assert.match(aplicar, /char_length\(decidido_aparelho\) <= 60\)/);
  assert.match(aplicar, /'20261122000356', '0356_aprovacoes_decidido_aparelho'/);
  assert.match(aplicar, /where not exists/);
  const rb = readFileSync("supabase/producao/rollback/0356_rollback.sql", "utf8");
  assert.match(rb, /drop column if exists decidido_aparelho/);
  assert.match(rb, /version = '20261122000356'/);
});
