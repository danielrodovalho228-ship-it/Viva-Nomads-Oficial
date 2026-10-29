import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Lab verde: depois do E193 a escala "Limpezas por mês" é de pílulas; a t212 não pode mais usar selectOption nela.
const spec = readFileSync("tests/e2e/specs/t212-ferramentas-proprietario.spec.ts", "utf8");
const tela = readFileSync("src/components/anuncio/blocos-cadastro.tsx", "utf8");

test("t212 escolhe as limpezas pela pílula, não por lista suspensa", () => {
  assert.ok(!/getByLabel\("Limpezas por mês que posso incluir"\)\.selectOption/.test(spec));
  assert.match(spec, /getByTestId\("limite-limpezas-2"\)\.click\(\)/);
});

test("a tela mantém o testid que a t212 usa", () => {
  assert.match(tela, /limite-limpezas-\$\{o\.v \?\? "sem"\}/);
});
