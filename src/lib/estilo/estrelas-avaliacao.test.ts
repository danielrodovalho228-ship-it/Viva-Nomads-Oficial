import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Varredura 01/11 (achado 10): no formulário de avaliação as estrelas vazias (o próprio controle da nota) eram sage-200
// sobre branco (1,25:1); controle gráfico pede 3:1. Vazia: contorno sage (#2e7d5b, ~5,2:1); marcada: champagne-600.
test("estrelas do formulário de avaliação visíveis (contraste de controle ≥ 3:1)", () => {
  const f = readFileSync(new URL("../../components/avaliacao-form.tsx", import.meta.url), "utf8");
  // E679: a marcada é o dourado do mockup (preenchimento amber-500, contorno amber-600 ≥ 3:1); a vazia segue sage.
  assert.match(f, /ativa \? "fill-amber-500 stroke-amber-600 text-amber-600" : "text-sage"/);
  assert.match(f, /estrela\(\(hover \|\| rating\) >= n\)/);
  assert.doesNotMatch(f, /: "text-sage-200"/);
  const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /--color-sage: #2e7d5b;/);
  assert.match(css, /--color-champagne-600: #4fa01e;/);
});
