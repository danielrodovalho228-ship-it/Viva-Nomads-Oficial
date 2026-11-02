/* Roda: node --test "src/app/(dashboard)/dashboard/simulador/prazos-alvo.test.ts" — varredura 01/11 (Pista A): no Simulador os prazos (2, 3, 4, 6 meses) tinham 38 px e a régua de imóveis ativos 16 px de altura no celular; agora 44 px. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("Simulador: prazos com 44 px", () => {
  assert.match(src, /inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors[\s\S]*className="h-11 w-full accent-forest"/);
  assert.doesNotMatch(src, /rounded-full border px-4 py-2 text-sm font-medium transition-colors \$\{e\.prazoMedioMeses/);
});
