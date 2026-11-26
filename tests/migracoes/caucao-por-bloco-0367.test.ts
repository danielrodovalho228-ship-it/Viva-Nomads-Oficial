/*
  Roda: node --test tests/migracoes/caucao-por-bloco-0367.test.ts
  0367 (E1225, ORDEM-DUET-1120): a caução passa a uma por BLOCO. O índice único "uma caução ativa por contrato" (0182)
  dá lugar a "uma por bloco"; as cauções de antes (sem bloco) continuam uma por contrato; o check deixa a caução ter
  bloco; a política do dono aceita a caução num bloco do mesmo contrato. Nenhuma linha que já existe muda.
  Esta trava só LÊ o texto: é o complemento barato contra os mutantes de forma. A prova que afirma o comportamento é a
  EXECUTADA (regra da casa, ORDEM-DUET-1078): a t1798, com a fixture tests/e2e/fixtures/prova-0367.ts, a 0367, o aplicar
  e o rollback de verdade num banco descartável.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const sql = (s: string) => s.replace(/--[^\n]*/g, "").replace(/\s+/g, " ").trim();
const MIG = sql(readFileSync("supabase/migrations/0367_caucao_por_bloco_e1225.sql", "utf8"));
const APLICAR = sql(readFileSync("supabase/producao/aplicar-0367.sql", "utf8"));
const ROLLBACK = sql(readFileSync("supabase/producao/rollback/0367_rollback.sql", "utf8"));
const IDA = { "migração": MIG, "aplicar-0367": APLICAR } as const;

const POR_BLOCO = /create unique index if not exists pagamentos_bloco_uma_caucao_por_bloco on public\.pagamentos_bloco \(bloco_id\) where tipo = 'caucao' and bloco_id is not null and anulado_em is null;/;
const SEM_BLOCO = /create unique index if not exists pagamentos_bloco_uma_caucao_sem_bloco on public\.pagamentos_bloco \(contrato_id\) where tipo = 'caucao' and bloco_id is null and anulado_em is null;/;
const SAI_O_ANTIGO = /drop index if exists public\.pagamentos_bloco_uma_caucao;/;
const ANTIGO = /create unique index if not exists pagamentos_bloco_uma_caucao on public\.pagamentos_bloco \(contrato_id\) where tipo = 'caucao' and anulado_em is null;/;

test("0367: os índices novos nascem antes de o antigo sair", () => {
  for (const [nome, s] of Object.entries(IDA)) {
    assert.match(s, POR_BLOCO, `${nome}: uma caução ativa por bloco`);
    assert.match(s, SEM_BLOCO, `${nome}: as de antes, sem bloco, continuam uma por contrato`);
    assert.match(s, SAI_O_ANTIGO, `${nome}: o índice por contrato sai`);
    assert.ok(s.search(POR_BLOCO) < s.search(SAI_O_ANTIGO) && s.search(SEM_BLOCO) < s.search(SAI_O_ANTIGO), `${nome}: nenhum instante sem a regra`);
  }
});

test("0367: o check deixa a caução ter bloco; o aluguel continua com bloco", () => {
  for (const [nome, s] of Object.entries(IDA)) {
    assert.match(s, /add constraint pagamentos_bloco_bloco_por_tipo check \(tipo = 'caucao' or \(tipo = 'aluguel' and bloco_id is not null\)\) not valid;/, nome);
  }
});

test("0367: a política do dono aceita a caução num bloco do MESMO contrato (e a de antes, sem bloco)", () => {
  for (const [nome, s] of Object.entries(IDA)) {
    assert.match(s, /alter policy "proprietário registra recebimento" on public\.pagamentos_bloco/, nome);
    assert.match(s, /\(tipo = 'caucao' and bloco_id is null\) or \(tipo in \('aluguel', 'caucao'\) and exists \( select 1 from public\.contrato_blocos b where b\.id = pagamentos_bloco\.bloco_id and b\.contrato_id = pagamentos_bloco\.contrato_id \)\)/, nome);
  }
});

test("0367: nenhuma linha muda", () => {
  for (const [nome, s] of Object.entries({ ...IDA, rollback: ROLLBACK })) {
    assert.doesNotMatch(s, /\b(delete from|update|truncate)\s+(public\.)?pagamentos_bloco\b/i, `${nome}: não apaga nem regrava registro`);
    assert.doesNotMatch(s, /\banulado_em\s*=/i, `${nome}: não anula registro`);
  }
});

test("aplicar-0367: numa transação curta, regista-se com o nome da migração", () => {
  assert.match(APLICAR, /^begin; set local lock_timeout = '5s';[\s\S]*commit;$/);
  assert.match(APLICAR, /insert into supabase_migrations\.schema_migrations \(version, name\) select '20261126000367', '0367_caucao_por_bloco_e1225' where not exists/);
});

test("rollback da 0367: repõe o índice por contrato ANTES de tirar os novos, numa transação só, sem engolir a falha", () => {
  assert.ok(existsSync("supabase/producao/rollback/0367_rollback.sql"));
  assert.match(ROLLBACK, /^begin;[\s\S]*commit;$/);
  assert.match(ROLLBACK, ANTIGO);
  const repoe = ROLLBACK.search(ANTIGO);
  for (const depois of [/drop index if exists public\.pagamentos_bloco_uma_caucao_por_bloco;/, /drop index if exists public\.pagamentos_bloco_uma_caucao_sem_bloco;/, /delete from supabase_migrations\.schema_migrations where version = '20261126000367';/]) {
    assert.ok(ROLLBACK.search(depois) > repoe, `${depois} só depois de repor o índice por contrato`);
  }
  assert.doesNotMatch(ROLLBACK, /exception when/i);
});
