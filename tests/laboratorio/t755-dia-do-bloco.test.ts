import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// E744 + E1073: o bloco da t755 nasce no dia de BRASÍLIA, o relógio do app (antes nascia no dia UTC, que depois das 21h de
// Brasília já era "amanhã": o contrato não estava em vigência e a conferência de entrada ainda não teria aberto).
//
// ASSERÇÕES ALTERADAS no E1073 (delta de guarda aprovado na ORDEM-DUET-374). A guarda cobrava "massa e spec no mesmo relógio,
// o UTC"; passa a cobrar "massa e spec no mesmo relógio, o de Brasília". Antes:
//   título: "t755: a 1ª célula marcada é o dia do bloco (UTC), igual ao que a fixture grava"
//   assert.match(fix, /const dia = \(d: Date\) => d\.toISOString\(\)\.slice\(0, 10\)/);
//   assert.match(spec, /const diaDoBloco = \(\) => new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/);
//   assert.doesNotMatch(spec, /agenda-dia-\$\{diaBR\(0\)\}`\)\)\.toHaveAttribute\("data-estadia"/);   ← saiu: proibia conferir a
//     célula de "hoje em Brasília" porque a massa gravava UTC; com a massa em Brasília a proibição deixa de ter objecto.
// A asserção da célula do dia do bloco (a última) não mudou.
test("t755: a 1ª célula marcada é o dia do bloco (Brasília), igual ao que a fixture grava", () => {
  const fix = readFileSync("tests/e2e/fixtures/laboratorio.ts", "utf8");
  assert.match(fix, /const hoje = hojeBR\(\);/);
  assert.match(fix, /const linhaBloco = \{ inicio: hoje, fim: addDiasISO\(hoje, 59\),/);
  const spec = readFileSync("tests/e2e/specs/t755-agenda-a-periodo-ical.spec.ts", "utf8");
  assert.match(spec, /const diaDoBloco = \(\) => diaBR\(0\);/);
  assert.match(spec, /agenda-dia-\$\{diaDoBloco\(\)\}`\)\)\.toHaveAttribute\("data-estadia", "1"\)/);
});
