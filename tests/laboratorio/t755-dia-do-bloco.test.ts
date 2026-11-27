import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// E744: o bloco da t755 nasce no dia UTC; depois das 21h de Brasília isso é "amanhã" para quem lê o relógio de Brasília.
test("t755: a 1ª célula marcada é o dia do bloco (UTC), igual ao que a fixture grava", () => {
  const fix = readFileSync("tests/e2e/fixtures/laboratorio.ts", "utf8");
  assert.match(fix, /const dia = \(d: Date\) => d\.toISOString\(\)\.slice\(0, 10\)/);
  const spec = readFileSync("tests/e2e/specs/t755-agenda-a-periodo-ical.spec.ts", "utf8");
  assert.match(spec, /const diaDoBloco = \(\) => new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/);
  assert.match(spec, /agenda-dia-\$\{diaDoBloco\(\)\}`\)\)\.toHaveAttribute\("data-estadia", "1"\)/);
  assert.doesNotMatch(spec, /agenda-dia-\$\{diaBR\(0\)\}`\)\)\.toHaveAttribute\("data-estadia"/);
});
