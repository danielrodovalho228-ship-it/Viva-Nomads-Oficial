import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// E1046 (ORDEM-DUET-239): no celular, o logo do topo do painel tinha 153 × 32 px — o mesmo defeito do E960, que corrigiu
// o logo do site público. `min-h-11` dá os 44 px à própria âncora; o símbolo e o nome ficam centrados nela (a raiz do
// Logo é inline-flex items-center), por isso o desenho não muda. O padrão é 44 × 44 de área real (E1033).
test("celular: o logo do topo do painel tem 44 px na própria âncora", () => {
  const shell = readFileSync(new URL("./dashboard-shell.tsx", import.meta.url), "utf8");
  const logoDoCelular = [...shell.matchAll(/<Logo\b[^>]*\/>/g)].map((m) => m[0]).find((l) => /lg:hidden/.test(l));
  assert.ok(logoDoCelular, "o shell desenha o logo do topo do celular (lg:hidden)");
  assert.match(logoDoCelular!, /className="[^"]*\bmin-h-11\b[^"]*"/, "min-h-11 = 44 px, na própria âncora");
  // Continua a seguir a convenção do E443 (sem destino próprio = página inicial) e a do E1025 (sem pré-carregar).
  assert.doesNotMatch(logoDoCelular!, /href=/);
  assert.match(logoDoCelular!, /prefetch=\{false\}/);
});
