import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { digitarData } from "./data-digitada.ts";

/*
  E747 🔴 (prova logada do Gerente, 14/11, assistente de anúncio › Disponibilidade): digitar "2026-11-15" no campo
  dd/mm/aaaa virava "01/11/2026" — no meio da digitação, "2026-11-1" já casava como data ISO e era convertida (dia 1);
  o "5" seguinte não mudava mais nada. Regra: o campo PRESERVA a data digitada; ISO só vira data quando está completo
  (AAAA-MM-DD); ISO inexistente fica como digitado e avisa — nunca troca por outra data.
*/
function digitar(texto: string) {
  let campo = "";
  let ultimo = { texto: "", iso: "", invalido: false };
  for (const ch of texto) {
    ultimo = digitarData(campo + ch);
    campo = ultimo.texto;
  }
  return ultimo;
}

test("digitar ISO válido futuro, tecla a tecla: entra a MESMA data (15/11/2026), nunca 01/11/2026", () => {
  const r = digitar("2026-11-15");
  assert.deepEqual(r, { texto: "15/11/2026", iso: "2026-11-15", invalido: false });
});

test("no meio da digitação ('2026-11-1') o campo não converte para o dia 1", () => {
  const r = digitarData("2026-11-1");
  assert.equal(r.iso, "", "ainda não há data");
  assert.doesNotMatch(r.texto, /01\/11\/2026/);
});

test("ISO inexistente (2026-02-31) fica como digitado e avisa, sem trocar por outra data", () => {
  const r = digitar("2026-02-31");
  assert.equal(r.iso, "");
  assert.equal(r.invalido, true);
  assert.equal(r.texto, "2026-02-31");
});

test("ISO passado (2026-11-01) entra como a mesma data — a regra de 'passada' avisa depois, sem trocar a data", () => {
  assert.deepEqual(digitar("2026-11-01"), { texto: "01/11/2026", iso: "2026-11-01", invalido: false });
});

test("o formato brasileiro continua igual", () => {
  assert.deepEqual(digitar("15112026"), { texto: "15/11/2026", iso: "2026-11-15", invalido: false });
});

test("o campo de data usa digitarData (não converte ISO incompleto por conta própria)", () => {
  const c = readFileSync("src/components/ui/campo-data.tsx", "utf8");
  assert.match(c, /digitarData\(/);
  assert.doesNotMatch(c, /\\d\{4\}-\\d\{1,2\}-\\d\{1,2\}/);
});
