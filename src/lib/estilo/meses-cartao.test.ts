import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// mesesDoCartao mora no componente (TSX); a regra é conferida pelo texto do arquivo e por uma cópia mínima.
const c = readFileSync(new URL("../../components/property-card.tsx", import.meta.url), "utf8");

test("total da estadia: duração da busca ou, sem busca, a estadia mínima do imóvel (adendo do Prompt 40)", () => {
  assert.match(c, /if \(periodMonths && periodMonths > 0\) return periodMonths;/);
  assert.match(c, /return Math\.max\(1, Math\.ceil\(\(minPeriodDays \?\? 30\) \/ 30\)\);/);
  const meses = (p: number | undefined, min: number | undefined) => (p && p > 0 ? p : Math.max(1, Math.ceil((min ?? 30) / 30)));
  assert.equal(meses(3, 30), 3);
  assert.equal(meses(undefined, 30), 1);
  assert.equal(meses(undefined, 60), 2);
  assert.equal(meses(undefined, 90), 3);
  assert.equal(meses(0, 45), 2);
});
