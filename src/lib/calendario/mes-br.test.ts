import test from "node:test";
import assert from "node:assert/strict";
import { gradeDoMes, hojeIsoBrasilia, INICIAIS_SEMANA_BR, mesDe, mesVizinho, somarDias, rotuloDiaBR, TEXTOS_CALENDARIO, tituloMesBR } from "./mes-br.ts";

test("E136 — o calendário em pt-BR: mês, dias da semana, rótulos e botões", () => {
  assert.equal(tituloMesBR(2026, 10), "novembro de 2026");
  assert.deepEqual([...INICIAIS_SEMANA_BR], ["D", "S", "T", "Q", "Q", "S", "S"]);
  assert.equal(rotuloDiaBR("2026-11-01"), "domingo, 1 de novembro de 2026");
  assert.equal(rotuloDiaBR("2026-11-25"), "quarta-feira, 25 de novembro de 2026");
  assert.equal(TEXTOS_CALENDARIO.limpar, "Limpar");
  assert.equal(TEXTOS_CALENDARIO.hoje, "Hoje");
  const tudo = JSON.stringify(TEXTOS_CALENDARIO);
  assert.doesNotMatch(tudo, /Clear|Today|previous|next|month/i);
});

test("E136 — a grade de novembro de 2026 começa no domingo, dia 1", () => {
  const g = gradeDoMes(2026, 10);
  assert.equal(g[0][0], "2026-11-01");
  assert.equal(g.flat().filter(Boolean).length, 30);
  assert.ok(g.every((s) => s.length === 7));
  const fev = gradeDoMes(2027, 1);
  assert.equal(fev.flat().filter(Boolean).length, 28);
  assert.equal(fev[0].indexOf("2027-02-01"), 1, "1º de fevereiro de 2027 é segunda-feira");
});

test("E136 — virar o mês e o hoje de Brasília", () => {
  assert.deepEqual(mesVizinho(2026, 11, 1), { ano: 2027, mes0: 0 });
  assert.deepEqual(mesVizinho(2027, 0, -1), { ano: 2026, mes0: 11 });
  assert.equal(hojeIsoBrasilia(new Date("2026-10-26T02:00:00Z")), "2026-10-25");
});

test("E136 — andar pelo calendário com as setas atravessa mês e ano", () => {
  assert.equal(somarDias("2026-11-30", 1), "2026-12-01");
  assert.equal(somarDias("2027-01-03", -7), "2026-12-27");
  assert.deepEqual(mesDe("2026-11-25"), { ano: 2026, mes0: 10 });
});
