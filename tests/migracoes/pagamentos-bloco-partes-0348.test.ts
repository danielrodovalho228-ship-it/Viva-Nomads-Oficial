/*
  Roda: node --test tests/migracoes/pagamentos-bloco-partes-0348.test.ts
  0348 (E1072; ORDENS-DUET 1067 e 1071): um bloco pode ser pago em PARTES. A coluna pagamentos_bloco.parte (1 = o
  primeiro registro) e o índice único "um aluguel ativo por bloco E parte" no lugar de "um por bloco" (0182).
  Os quatro casos do coordenador (ORDEM-DUET-1071), no padrão da trava da 0365: cada caso lê a regra que o garante nos
  próprios arquivos da 0348 (a migração, o aplicar e o rollback), e cai quando essa regra é quebrada.
    1. um 2.º registro de aluguel ativo com a MESMA parte no mesmo bloco é recusado;
    2. a parte 2 no mesmo bloco é aceita;
    3. um registro anulado não ocupa a parte (anulada a parte 1, uma nova parte 1 é aceita);
    4. o rollback com um complementar ativo falha e nada muda (a coluna e os dois registros ficam).
  Esta trava só LÊ o texto: é o complemento barato contra os mutantes de forma. A prova que afirma o comportamento é a
  EXECUTADA (ORDEM-DUET-1078, regra da casa): os quatro casos corridos sobre a 0348 de verdade no banco do laboratório,
  na t1796 (tests/e2e/specs/t1796-0348-pagamentos-bloco-partes-executada.spec.ts, fixture tests/e2e/fixtures/prova-0348.ts).
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = (s: string) => s.replace(/--[^\n]*/g, "").replace(/\s+/g, " ").trim();
const MIG = sql(readFileSync("supabase/migrations/0348_pagamentos_bloco_partes_e1072.sql", "utf8"));
const APLICAR = sql(readFileSync("supabase/producao/aplicar-0348.sql", "utf8"));
const ROLLBACK = sql(readFileSync("supabase/producao/rollback/0348_rollback.sql", "utf8"));
const IDA = { "migração": MIG, "aplicar-0348": APLICAR } as const;

/** O índice único novo: por bloco E parte, só para o aluguel ativo (não anulado). */
const INDICE_NOVO =
  /create unique index if not exists pagamentos_bloco_uma_parte_por_bloco on public\.pagamentos_bloco \(bloco_id, parte\) where tipo = 'aluguel' and anulado_em is null;/;
const SAI_O_ANTIGO = /drop index if exists public\.pagamentos_bloco_um_valor_mensal;/;
/** O índice antigo (0182), que o rollback repõe: um aluguel ativo por bloco. */
const INDICE_ANTIGO =
  /create unique index if not exists pagamentos_bloco_um_valor_mensal on public\.pagamentos_bloco \(bloco_id\) where tipo = 'aluguel' and anulado_em is null;/;
const indices = (s: string) => [...s.matchAll(/create unique index[^;]*;/g)].map((m) => m[0]);

test("caso 1 — a mesma parte no mesmo bloco é recusada: o índice único é por (bloco_id, parte) e nasce antes de o antigo sair", () => {
  for (const [nome, s] of Object.entries(IDA)) {
    assert.match(s, INDICE_NOVO, `${nome}: o índice único por bloco e parte`);
    assert.match(s, SAI_O_ANTIGO, `${nome}: o índice antigo sai`);
    assert.ok(s.search(INDICE_NOVO) < s.search(SAI_O_ANTIGO), `${nome}: o novo nasce ANTES de o antigo sair (nenhum instante sem a regra)`);
    // Os registros que já existem e os que chegam sem dizer a parte ficam com parte = 1: o 2.º igual bate no índice.
    assert.match(s, /add column (if not exists )?parte integer not null default 1;/, `${nome}: parte obrigatória, 1 por omissão`);
  }
});

test("caso 2 — a parte 2 no mesmo bloco é aceita: nenhuma regra única fica só por bloco, e a parte vale de 1 para cima", () => {
  for (const [nome, s] of Object.entries(IDA)) {
    const unicos = indices(s);
    assert.equal(unicos.length, 1, `${nome}: um índice único só`);
    assert.match(unicos[0], /\(bloco_id, parte\)/, `${nome}: a parte faz parte da chave`);
    assert.doesNotMatch(s, /\(bloco_id\)/, `${nome}: nada único só por bloco`);
    assert.match(s, /add constraint pagamentos_bloco_parte_valida check \(parte >= 1\)/, `${nome}: parte 2 em diante é válida`);
  }
});

test("caso 3 — o anulado não ocupa a parte: a regra única só olha para o aluguel não anulado", () => {
  for (const [nome, s] of Object.entries(IDA)) {
    const [unico] = indices(s);
    assert.match(unico, / where tipo = 'aluguel' and anulado_em is null;$/, `${nome}: o registro anulado fica fora do índice`);
  }
});

test("caso 4 — o rollback com um complementar ativo falha e nada muda: repõe o índice antigo ANTES de tocar na coluna, numa transação só, sem apagar registro", () => {
  assert.match(ROLLBACK, /^begin;[\s\S]*commit;$/, "uma transação só: a falha desfaz tudo");
  assert.match(ROLLBACK, INDICE_ANTIGO, "repõe a regra de um por bloco — com dois ativos no bloco, esta criação falha");
  const repoe = ROLLBACK.search(INDICE_ANTIGO);
  for (const depois of [/drop index if exists public\.pagamentos_bloco_uma_parte_por_bloco;/, /drop constraint if exists pagamentos_bloco_parte_valida;/, /drop column if exists parte;/, /delete from supabase_migrations\.schema_migrations where version = '20261121000348';/]) {
    const i = ROLLBACK.search(depois);
    assert.ok(i > repoe, `${depois} só depois de repor o índice antigo (se a reposição falhar, a coluna e os registros ficam)`);
  }
  assert.doesNotMatch(ROLLBACK, /\b(delete from|update|truncate)\s+(public\.)?pagamentos_bloco\b/i, "o rollback não apaga nem regrava registro nenhum");
  assert.doesNotMatch(ROLLBACK, /\banulado_em\s*=/i, "o rollback não anula registro nenhum");
  assert.doesNotMatch(ROLLBACK, /exception when/i, "a falha da reposição não é engolida");
});

test("aplicar-0348: idempotente, numa transação curta, e regista-se com o nome da migração", () => {
  assert.match(APLICAR, /^begin; set local lock_timeout = '5s';[\s\S]*commit;$/);
  assert.match(APLICAR, /insert into supabase_migrations\.schema_migrations \(version, name\) select '20261121000348', '0348_pagamentos_bloco_partes_e1072' where not exists/);
  assert.doesNotMatch(APLICAR, /\b(delete from|update|truncate)\s+(public\.)?pagamentos_bloco\b/i, "não regrava valor de nenhuma linha");
});
