import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { mesesDaEstadia } from "./grade.ts";

test("E681: 17/01 a 17/03/2027 mostra janeiro, fevereiro e março", () => {
  assert.deepEqual(mesesDaEstadia("2027-01-17", "2027-03-17"), [
    { ano: 2027, mes: 0 },
    { ano: 2027, mes: 1 },
    { ano: 2027, mes: 2 },
  ]);
});

test("E681: atravessa o ano sem pular mês", () => {
  assert.deepEqual(
    mesesDaEstadia("2026-11-20", "2027-02-05").map((m) => `${m.ano}-${m.mes + 1}`),
    ["2026-11", "2026-12", "2027-1", "2027-2"],
  );
});

test("E681: estadia no mesmo mês, ou só com uma ponta, mostra um mês", () => {
  assert.equal(mesesDaEstadia("2027-01-02", "2027-01-30").length, 1);
  assert.deepEqual(mesesDaEstadia("2027-05-02", null), [{ ano: 2027, mes: 4 }]);
  assert.deepEqual(mesesDaEstadia(null, "2027-05-02"), [{ ano: 2027, mes: 4 }]);
  assert.deepEqual(mesesDaEstadia(null, null), []);
});

test("E681: a página da estadia monta os meses por mesesDaEstadia, não só pelas duas pontas", () => {
  const src = readFileSync("src/app/(dashboard)/dashboard/estadia/[contratoId]/page.tsx", "utf8");
  assert.match(src, /mesesDaEstadia\(/);
  assert.doesNotMatch(src, /new Set\(\[e\.periodo\.inicio, e\.periodo\.fim\]/);
});
