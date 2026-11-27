/**
 * Matriz, passada 10 (05/11): em /dashboard/carteira a 390 px, "Reservados" (com dica) e "Vagos" (sem dica) dividiam a
 * linha com alturas diferentes — o StatCard dentro de um invólucro (o <div data-testid> da grade) não ocupava a célula.
 * Regra da casa: cartões uniformes. O StatCard ocupa a altura toda da célula (h-full), com ou sem link. `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./primitives.tsx", import.meta.url), "utf8");

test("StatCard ocupa a altura da célula da grade (com e sem link)", () => {
  assert.match(src, /className="group relative block h-full rounded-xl border border-sage-200 bg-white p-3/);
  assert.match(src, /return <div className="h-full rounded-xl border border-sage-200 bg-white p-3 sm:p-4">\{body\}<\/div>;/);
});
