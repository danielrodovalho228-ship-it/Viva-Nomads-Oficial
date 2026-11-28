/*
  Roda: node --test tests/migracoes/horario-saida-0370.test.ts
  0370 (E1240, ESPEC-E1240 v5, secção 1; ORDEM-DUET 1324): a coluna contratos_checkin.horario_saida, a hora de saída das
  instruções (opcional). Só LÊ o texto: o complemento barato. A prova que afirma o comportamento é a EXECUTADA
  (tests/e2e/fixtures/prova-0370.ts, spec t1802).
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const sql = (s: string) => s.replace(/--[^\n]*/g, "").replace(/\s+/g, " ").trim();
const ler = (p: string) => (existsSync(p) ? sql(readFileSync(p, "utf8")) : "");
const MIG = ler("supabase/migrations/0370_contratos_checkin_horario_saida_e1240.sql");
const APLICAR = ler("supabase/producao/aplicar-0370.sql");
const ROLLBACK = ler("supabase/producao/rollback/0370_rollback.sql");
const FORMATO = "'^([01][0-9]|2[0-3]):[0-5][0-9]$'";

test("0370: a coluna horario_saida (texto, nula, sem default) com a regra do formato da hora de entrada, com nome", () => {
  for (const [nome, s] of Object.entries({ "migração": MIG, "aplicar-0370": APLICAR })) {
    assert.match(s, /alter table public\.contratos_checkin add column if not exists horario_saida text;/, nome);
    assert.ok(s.includes(`add constraint contratos_checkin_horario_saida_fmt check (horario_saida is null or horario_saida ~ ${FORMATO})`), `${nome}: a regra com nome`);
    assert.doesNotMatch(s, /default|not null|grant |update public\.contratos_checkin|delete from public\.contratos_checkin/i, `${nome}: não mexe nas linhas nem no acesso`);
  }
});
test("aplicar-0370: transação curta e registo com o nome", () => {
  assert.match(APLICAR, /^begin; set local lock_timeout = '5s';[\s\S]*commit;$/);
  assert.match(APLICAR, /insert into supabase_migrations\.schema_migrations \(version, name\) select '20261128000370', '0370_contratos_checkin_horario_saida_e1240' where not exists/);
});
test("rollback da 0370: com hora gravada levanta erro antes de mudar; senão tira a regra, a coluna e o registo", () => {
  assert.match(ROLLBACK, /^begin; set local lock_timeout = '5s';[\s\S]*commit;$/);
  const erro = ROLLBACK.indexOf("raise exception");
  assert.ok(erro > 0, "levanta erro quando há horas gravadas");
  for (const passo of [
    "alter table public.contratos_checkin drop constraint if exists contratos_checkin_horario_saida_fmt;",
    "alter table public.contratos_checkin drop column if exists horario_saida;",
    "delete from supabase_migrations.schema_migrations where version = '20261128000370';",
  ]) {
    const i = ROLLBACK.indexOf(passo);
    assert.ok(i > erro, `"${passo}" vem depois da conferência`);
  }
});
