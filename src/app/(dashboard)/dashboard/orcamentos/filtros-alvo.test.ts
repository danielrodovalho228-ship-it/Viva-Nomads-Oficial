/* Roda: node --test "src/app/(dashboard)/dashboard/orcamentos/filtros-alvo.test.ts" — varredura 01/11 (Pista A): em Orçamentos os filtros de status (Todas, Enviadas, Vistas…) tinham 34 px de altura no celular; agora 44 px. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./orcamentos-client.tsx", import.meta.url), "utf8");

test("Orçamentos: filtros com 44 px", () => {
  assert.match(src, /"inline-flex min-h-11 items-center rounded-full border px-4 text-xs font-medium transition-colors"/);
  assert.doesNotMatch(src, /"rounded-full border px-3 py-2 text-xs font-medium transition-colors"/);
});
