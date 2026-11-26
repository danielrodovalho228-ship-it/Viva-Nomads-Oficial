/*
  E1135 (ORDEM-DUET-590 §4, 591 §1, 592): o resto da família do "hoje em Brasília" lê a fonte única do E1115
  (`hojeEmBrasilia` / `diaBRT`, em `src/lib/datas-brasilia.ts`):
   - `hojeIsoBrasilia` (calendario/mes-br.ts) e `hojeBR` (utils.ts) deixam de ter a sua conta própria do fuso;
   - `visitaAmanha` (vistoria/regras.ts, o lembrete da véspera) deixa as −3 h fixas: o dia da visita é o de Brasília
     também quando Brasília não está em UTC−3 (o horário de verão até 2019);
   - `registroDoSistema` (vistoria/ativacao-automatica.ts) escreve no motivo a data de Brasília, não a de UTC.
  Roda: node --test src/lib/e1135-hoje-unico.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hojeEmBrasilia } from "./datas-brasilia.ts";
import { hojeIsoBrasilia } from "./calendario/mes-br.ts";
import { hojeBR } from "./utils.ts";
import { visitaAmanha } from "./vistoria/regras.ts";
import { registroDoSistema } from "./vistoria/ativacao-automatica.ts";
import { fonteSemComentarios as semComentarios } from "./fonte-sem-comentarios.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const corpo = (s: string, nome: string) => {
  const i = s.indexOf(`export function ${nome}(`);
  assert.ok(i >= 0, `${nome} existe`);
  return s.slice(i, s.indexOf("\n}\n", i) + 2);
};
const INSTANTES = ["2026-11-23T02:30:00Z", "2026-11-23T00:00:00Z", "2026-11-23T03:00:00Z", "2026-02-15T01:00:00Z", "2018-11-05T02:30:00Z"];

test("E1135: hojeIsoBrasilia e hojeBR são a fonte única — o mesmo dia, sem conta própria do fuso", () => {
  for (const iso of INSTANTES) {
    assert.equal(hojeIsoBrasilia(new Date(iso)), hojeEmBrasilia(new Date(iso)), `hojeIsoBrasilia ${iso}`);
    assert.equal(hojeBR(new Date(iso)), hojeEmBrasilia(new Date(iso)), `hojeBR ${iso}`);
  }
  const mes = corpo(semComentarios(ler("src/lib/calendario/mes-br.ts")), "hojeIsoBrasilia");
  assert.doesNotMatch(mes, /Intl\.DateTimeFormat/);
  assert.match(mes, /return hojeEmBrasilia\(agora\);/);
  const utils = corpo(semComentarios(ler("src/lib/utils.ts")), "hojeBR");
  assert.doesNotMatch(utils, /isoDiaBR|Intl\.DateTimeFormat/);
  assert.match(utils, /return hojeEmBrasilia\(agora\);/);
});

test("E1135: visitaAmanha acha o dia da visita em Brasília — sem −3 h fixas (vale também no horário de verão)", () => {
  // Os casos de hoje (UTC−3) ficam iguais.
  assert.equal(visitaAmanha("2026-10-24T13:00:00Z", "2026-10-23"), true);
  assert.equal(visitaAmanha("2026-10-25T13:00:00Z", "2026-10-23"), false);
  // 23/11 às 23:30 de Brasília (já 24/11 em UTC): a visita é no dia 23 → "amanhã" de 22/11.
  assert.equal(visitaAmanha("2026-11-24T02:30:00Z", "2026-11-22"), true);
  assert.equal(visitaAmanha("2026-11-24T02:30:00Z", "2026-11-23"), false);
  // Horário de verão (UTC−2, 04/11/2018): 05/11 02:30 UTC = 05/11 00:30 em Brasília. Com −3 h fixas dava 04/11.
  assert.equal(visitaAmanha("2018-11-05T02:30:00Z", "2018-11-04"), true);
  assert.equal(visitaAmanha("2018-11-05T02:30:00Z", "2018-11-03"), false);
  const s = corpo(semComentarios(ler("src/lib/vistoria/regras.ts")), "visitaAmanha");
  assert.doesNotMatch(s, /3 \* 3_?600_?000|-03:00/);
  assert.match(s, /diaBRT\(agendadoPara\)/);
});

test("E1135: o motivo da decisão automática leva a data de Brasília, não a de UTC", () => {
  const criterios = { identidadeVerificada: true } as unknown as Parameters<typeof registroDoSistema>[1];
  // 22/11 às 23:30 de Brasília = 23/11 02:30 UTC.
  const r = registroDoSistema("em_teste", criterios, { identidade: "real" }, new Date("2026-11-23T02:30:00Z"));
  assert.match(r.motivo, /^Decidido pelo sistema em 2026-11-22 \(/);
  // O instante exacto continua em UTC no registo estruturado (é um instante, não um dia).
  assert.equal(r.criterios.em, "2026-11-23T02:30:00.000Z");
  const s = corpo(semComentarios(ler("src/lib/vistoria/ativacao-automatica.ts")), "registroDoSistema");
  assert.match(s, /const quando = hojeEmBrasilia\(agora\);/);
});
