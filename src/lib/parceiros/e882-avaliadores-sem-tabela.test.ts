import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// E882: /parceiros/avaliadores citava uma "tabela da Viva" que não aparece em nenhuma superfície pública.
// A frase passa a falar do valor de referência que o painel do avaliador mostra em cada pedido.
const src = readFileSync("src/app/(public)/parceiros/avaliadores/page.tsx", "utf8");

test("E882: a página de avaliadores não cita 'tabela da Viva'", () => {
  assert.doesNotMatch(src, /tabela da Viva/i);
  assert.match(src, /\{FRASE_REFERENCIA_AVALIADOR\}/);
});

test("E882: a frase de referência fala do valor de referência de cada pedido e não de tabela", async () => {
  const { FRASE_REFERENCIA_AVALIADOR } = await import("../vistoria/regras.ts");
  assert.doesNotMatch(FRASE_REFERENCIA_AVALIADOR, /tabela/i);
  assert.match(FRASE_REFERENCIA_AVALIADOR, /você define o seu valor e o seu prazo/i);
  assert.match(FRASE_REFERENCIA_AVALIADOR, /valor de referência que aparece em cada pedido[^.]*só uma referência/i);
});
