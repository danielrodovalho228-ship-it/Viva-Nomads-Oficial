/*
  E948 — T1 (emenda do coordenador; decisão do Daniel, 15/11: "Pular feriados"). Calendário único de dias úteis:
  feriados nacionais (9 fixos + Sexta-feira Santa por Meeus/Jones/Butcher), fora Carnaval e Corpus Christi; somarDiasUteis
  em horário de Brasília; o prazo do dono (E395/E722) e as horas úteis do laudo usam o mesmo calendário.
  Roda: node --test src/lib/calendario/e948-calendario.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ehDiaUtil, feriadoNacional } from "./feriados-nacionais.ts";
import { somarDiasUteis } from "./dias-uteis.ts";
import { prazoDoDono } from "../propostas/pre-aceitacao.ts";
import { somarHorasUteis } from "../vistoria/laudo.ts";

/** Instante em Brasília (UTC−3). */
const brt = (iso: string) => new Date(`${iso}-03:00`);
const ver = (d: Date) => new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 16);

test("feriadoNacional: as 9 datas fixas", () => {
  for (const d of ["2026-01-01", "2026-04-21", "2026-05-01", "2026-09-07", "2026-10-12", "2026-11-02", "2026-11-15", "2026-11-20", "2026-12-25"]) {
    assert.ok(feriadoNacional(d), d);
    assert.equal(ehDiaUtil(d), false, d);
  }
});

test("feriadoNacional: Sexta-feira Santa em 03/04/2026, 26/03/2027, 14/04/2028 e 19/04/2030", () => {
  for (const d of ["2026-04-03", "2027-03-26", "2028-04-14", "2030-04-19"]) assert.equal(feriadoNacional(d), "Sexta-feira Santa", d);
});

test("feriadoNacional: Carnaval e Corpus Christi NÃO são feriado nacional", () => {
  assert.equal(feriadoNacional("2027-02-09"), null, "terça de Carnaval 2027");
  assert.equal(feriadoNacional("2027-05-27"), null, "Corpus Christi 2027");
  assert.equal(ehDiaUtil("2027-02-09"), true);
});

test("somarDiasUteis (Brasília): feriados", () => {
  const casos: [string, number, string, string][] = [
    ["2026-11-19T10:00", 2, "2026-11-24T10:00", "20/11 é feriado"],
    ["2026-12-24T10:00", 2, "2026-12-29T10:00", "25/12 é feriado"],
    ["2026-10-30T10:00", 1, "2026-11-03T10:00", "02/11 é feriado"],
    ["2027-03-25T10:00", 1, "2027-03-29T10:00", "Sexta-feira Santa"],
    ["2026-11-20T15:00", 2, "2026-11-25T00:00", "começa no feriado: conta a partir de segunda 23/11 00h"],
  ];
  for (const [ini, n, esperado, por] of casos) assert.equal(ver(somarDiasUteis(brt(ini), n)), esperado, por);
});

test("somarDiasUteis (Brasília): os casos sem feriado do T1 original", () => {
  assert.equal(ver(somarDiasUteis(brt("2026-11-09T10:00"), 2)), "2026-11-11T10:00", "segunda 10h + 2 → quarta 10h");
  assert.equal(ver(somarDiasUteis(brt("2026-11-13T10:00"), 2)), "2026-11-17T10:00", "sexta 10h + 2 → terça 10h");
  assert.equal(ver(somarDiasUteis(brt("2026-11-07T15:00"), 2)), "2026-11-11T00:00", "sábado 15h + 2 → quarta 00h");
});

test("prazoDoDono (E395/E722): candidatura devolvida na quinta 19/11/2026, 10h → segunda 23/11/2026, 10h", () => {
  assert.equal(ver(prazoDoDono(brt("2026-11-19T10:00"), null)), "2026-11-23T10:00");
});

test("somarHorasUteis (laudo): um caso que atravessa 20/11/2026 não conta horas nesse dia", () => {
  // Quinta 19/11 20h + 6 horas úteis: 4 h na quinta (até 00h), 20/11 (feriado) pulado, sábado e domingo pulados → segunda 23/11 02h.
  assert.equal(ver(somarHorasUteis(brt("2026-11-19T20:00"), 6)), "2026-11-23T02:00");
});

test("estático: pre-aceitacao.ts e laudo.ts usam o calendário único; não sobra outra regra de fim de semana nos prazos", () => {
  const pre = readFileSync(new URL("../propostas/pre-aceitacao.ts", import.meta.url), "utf8");
  const laudo = readFileSync(new URL("../vistoria/laudo.ts", import.meta.url), "utf8");
  assert.match(pre, /from "\.\.\/calendario\/dias-uteis\.ts"/);
  assert.match(laudo, /from "\.\.\/calendario\/dias-uteis\.ts"/);
  for (const [nome, s] of [["pre-aceitacao", pre], ["laudo", laudo]] as const) {
    assert.doesNotMatch(s, /getUTCDay\(\)\s*===\s*[06]|dow\([^)]*\)\s*===\s*[06]/, `${nome}: regra de fim de semana própria`);
    assert.doesNotMatch(s, /"\d{2}-\d{2}":\s*"/, `${nome}: lista de feriados própria`);
  }
});
