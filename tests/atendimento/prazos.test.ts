/*
  QA 06/out (VN-000100): chamado respondido no prazo não fica "em risco".
  slaDoChamado espelha atendimento_sla_calculado (0075).
  Roda: node --test tests/atendimento/prazos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { slaDoChamado } from "../../src/config/atendimento.ts";

const d = (s: string) => new Date(`${s}-03:00`);
// VN-000100: aberto 05/10 22:09, 1ª resposta até 06/10 11:00 (respondido 10:32), resolução até 07/10 22:00.
const VN100 = {
  criadoEm: d("2026-10-05T22:09"),
  prazoPrimeiraResposta: d("2026-10-06T11:00"),
  primeiraRespostaEm: d("2026-10-06T10:32") as Date | null,
  prazoResolucao: d("2026-10-07T22:00"),
  resolvidoEm: null as Date | null,
  fechado: false,
};

test("VN-000100: respondido no prazo → ok (antes ficava 'em risco' para sempre)", () => {
  assert.equal(slaDoChamado({ ...VN100, agora: d("2026-10-06T19:50") }), "ok");
});

test("depois da 1ª resposta vale o prazo de resolução (75% = em risco; passou = estourado)", () => {
  assert.equal(slaDoChamado({ ...VN100, agora: d("2026-10-07T11:00") }), "em_risco");
  assert.equal(slaDoChamado({ ...VN100, agora: d("2026-10-07T22:01") }), "estourado");
});

test("sem resposta: relógio da 1ª resposta; resposta atrasada fica registrada como estourado", () => {
  const sem = { ...VN100, primeiraRespostaEm: null };
  assert.equal(slaDoChamado({ ...sem, agora: d("2026-10-06T00:00") }), "ok");
  assert.equal(slaDoChamado({ ...sem, agora: d("2026-10-06T08:30") }), "em_risco");
  assert.equal(slaDoChamado({ ...sem, agora: d("2026-10-06T11:01") }), "estourado");
  assert.equal(slaDoChamado({ ...VN100, primeiraRespostaEm: d("2026-10-06T11:30"), agora: d("2026-10-06T12:00") }), "estourado");
});

test("fechado: ok se cumpriu os dois prazos", () => {
  assert.equal(slaDoChamado({ ...VN100, fechado: true, resolvidoEm: d("2026-10-07T09:00"), agora: d("2026-10-08T00:00") }), "ok");
  assert.equal(slaDoChamado({ ...VN100, fechado: true, resolvidoEm: d("2026-10-08T09:00"), agora: d("2026-10-08T10:00") }), "estourado");
});

test("servidor recalcula o prazo depois de responder, resolver e mudar prioridade/status; 0075 cobre chamados respondidos", () => {
  const acoes = readFileSync(new URL("../../src/lib/data/atendimento-actions.ts", import.meta.url), "utf8");
  assert.ok((acoes.match(/rpc\("atendimento_varrer_prazos"\)/g) ?? []).length >= 3);
  const sql = readFileSync(new URL("../../supabase/migrations/0075_atendimento_prazo_resolucao.sql", import.meta.url), "utf8");
  assert.match(sql, /when c\.primeira_resposta_em > c\.prazo_primeira_resposta then 'estourado'/);
  assert.match(sql, /when agora >= c\.prazo_resolucao then 'estourado'/);
  assert.doesNotMatch(sql.split("create or replace function public.atendimento_varrer_prazos")[1], /where c\.primeira_resposta_em is null/);
});
