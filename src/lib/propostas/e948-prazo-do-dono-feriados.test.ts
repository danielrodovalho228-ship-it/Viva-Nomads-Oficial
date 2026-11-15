/*
  E948 (emenda de feriados, decidida em 15/11) — trava nomeada, entregue pela Pista 3 (achado no t2036/#3848).
  Regra: o relógio do dono (prazoDoDono, E395) conta 1 dia útil saltando sábado, domingo, os 9 feriados nacionais
  fixos e a Sexta-feira Santa (calendário único). VERMELHA na main 403858f7 (só salta sáb/dom); tem de ficar verde
  com o PR da Família 6. Destino sugerido: src/lib/propostas/e948-prazo-do-dono-feriados.test.ts
  Roda: node --test src/lib/propostas/e948-prazo-do-dono-feriados.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { prazoDoDono } from "./pre-aceitacao.ts";

const brt = (s: string) => new Date(`${s}-03:00`);

test("E948: quinta 19/11/2026 10:00 → o dia seguinte é feriado (Consciência Negra, 20/11) → segunda 23/11 10:00", () => {
  assert.equal(prazoDoDono(brt("2026-11-19T10:00:00"), null).toISOString(), brt("2026-11-23T10:00:00").toISOString());
});

test("E948: véspera de Natal (quinta 24/12/2026) → sexta 25/12 é feriado → segunda 28/12", () => {
  assert.equal(prazoDoDono(brt("2026-12-24T15:00:00"), null).toISOString(), brt("2026-12-28T15:00:00").toISOString());
});

test("E948: Sexta-feira Santa (03/04/2026) — quinta 02/04 → segunda 06/04", () => {
  assert.equal(prazoDoDono(brt("2026-04-02T09:30:00"), null).toISOString(), brt("2026-04-06T09:30:00").toISOString());
});

test("E948 (controlo, verde antes e depois): dia útil comum segue igual e o tecto da entrada continua", () => {
  assert.equal(prazoDoDono(brt("2026-11-10T10:00:00"), null).toISOString(), brt("2026-11-11T10:00:00").toISOString());
  assert.equal(prazoDoDono(brt("2026-11-19T10:00:00"), "2026-11-20").toISOString(), brt("2026-11-20T00:00:00").toISOString());
});
