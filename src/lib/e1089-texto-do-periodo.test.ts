/*
  E1089 (prompt do coordenador, ORDEM-DUET-448; classe B): uma só data de saída em todas as telas. O período gravado é
  [entrada, entrada + dias): 31 dias = 31 noites. O contrato, a estadia, os calendários, os e-mails e a conferência de
  saída imprimiam a ÚLTIMA NOITE (o fim inclusivo dos blocos) como se fosse a saída ("23/11 a 23/12"); a proposta e a
  candidatura já imprimiam a saída (entrada + dias: 24/12). Fonte única do que se mostra: textoDoPeriodo.
  Roda: node --test src/lib/e1089-texto-do-periodo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { periodoPeloFim, textoDoPeriodo } from "./texto-do-periodo.ts";

test("E1089: 23/11 + 31 dias → saída 24/12, última noite 23/12, 31 diárias (o caso da ORC-2026-0019)", () => {
  const p = textoDoPeriodo({ entrada: "2026-11-23", dias: 31 })!;
  assert.equal(p.entrada, "2026-11-23");
  assert.equal(p.saida, "2026-12-24");
  assert.equal(p.ultimaNoite, "2026-12-23");
  assert.equal(p.diarias, 31);
  assert.equal(p.linha, "Entrada 23/11/2026 · Saída 24/12/2026 · 31 diárias");
  assert.equal(p.linhaCurta, "Entrada 23/11 · Saída 24/12 · 31 diárias");
});

test("E1089: 10/01 + 31 dias → saída 10/02; a virada de ano; o fim de fevereiro", () => {
  assert.equal(textoDoPeriodo({ entrada: "2027-01-10", dias: 31 })!.saida, "2027-02-10");
  // Virada de ano: entra em dezembro, sai em janeiro.
  const virada = textoDoPeriodo({ entrada: "2026-12-15", dias: 30 })!;
  assert.equal(virada.saida, "2027-01-14");
  assert.equal(virada.ultimaNoite, "2027-01-13");
  assert.equal(virada.linha, "Entrada 15/12/2026 · Saída 14/01/2027 · 30 diárias");
  // Fim de fevereiro: ano comum e ano bissexto.
  assert.equal(textoDoPeriodo({ entrada: "2027-02-01", dias: 28 })!.saida, "2027-03-01");
  assert.equal(textoDoPeriodo({ entrada: "2027-02-01", dias: 28 })!.ultimaNoite, "2027-02-28");
  assert.equal(textoDoPeriodo({ entrada: "2028-02-01", dias: 28 })!.saida, "2028-02-29");
  assert.equal(textoDoPeriodo({ entrada: "2028-02-15", dias: 30 })!.saida, "2028-03-16");
});

test("E1089: a partir do fim gravado (a última noite dos blocos), a saída é o dia seguinte e as diárias fecham", () => {
  // O contrato da prova: blocos de 23/11 a 23/12 (fim inclusivo) → saída 24/12, 31 diárias — igual à proposta.
  const p = periodoPeloFim("2026-11-23", "2026-12-23")!;
  assert.deepEqual({ saida: p.saida, ultimaNoite: p.ultimaNoite, diarias: p.diarias }, { saida: "2026-12-24", ultimaNoite: "2026-12-23", diarias: 31 });
  assert.deepEqual(p, textoDoPeriodo({ entrada: "2026-11-23", dias: 31 }));
  // Datas com hora (timestamp do banco) valem pelo dia.
  assert.equal(periodoPeloFim("2026-11-23T00:00:00Z", "2026-12-23T00:00:00+00:00")!.saida, "2026-12-24");
});

test("E1089: uma diária no singular; sem data ou sem dias válidos, null (a tela não inventa período)", () => {
  assert.equal(textoDoPeriodo({ entrada: "2026-11-23", dias: 1 })!.linha, "Entrada 23/11/2026 · Saída 24/11/2026 · 1 diária");
  assert.equal(textoDoPeriodo({ entrada: "", dias: 31 }), null);
  assert.equal(textoDoPeriodo({ entrada: "2026-11-23", dias: 0 }), null);
  assert.equal(textoDoPeriodo({ entrada: "23/11/2026", dias: 31 }), null);
  assert.equal(periodoPeloFim("2026-11-23", null), null);
  assert.equal(periodoPeloFim("2026-12-23", "2026-11-23"), null, "fim antes da entrada");
});
