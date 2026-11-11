import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { periodoPorExtenso } from "../../src/lib/precos.ts";

// Rodada completa 5eb1fad9 (42a48ade, 10/11): t678 "4–5" esperava o seletor "Prazo total em meses" com valor "1".
// Desde o E655 (#3057), com candidatura de janela exata (30 dias) o Fechamento mostra o prazo em dias
// (data-testid="fechamento-prazo-dias", "30 dias (1 mês)") e o seletor de meses não é desenhado.
test("t678: a spec confere o prazo em dias que a tela desenha para a candidatura de 30 dias", () => {
  const spec = readFileSync("tests/e2e/specs/t678-e202-emails-candidatura.spec.ts", "utf8");
  assert.doesNotMatch(spec, /getByLabel\(\/Prazo total em meses\/i\)\)\.toHaveValue/, "o seletor de meses não aparece com janela em dias");
  const esperado = spec.match(/getByTestId\("fechamento-prazo-dias"\)\)\.toHaveText\("([^"]+)"/)?.[1];
  assert.ok(esperado, "a spec confere fechamento-prazo-dias");
  assert.equal(esperado, `30 dias (${periodoPorExtenso(30)})`);
  const tela = readFileSync("src/app/(dashboard)/dashboard/fechamento/closing-flow.tsx", "utf8");
  assert.match(tela, /data-testid="fechamento-prazo-dias"/);
  assert.match(tela, /`\$\{DIAS_ACORDO\} dias \(\$\{periodoPorExtenso\(DIAS_ACORDO\)\}\)`/);
});
