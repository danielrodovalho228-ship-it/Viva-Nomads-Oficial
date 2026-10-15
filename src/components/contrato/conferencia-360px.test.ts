import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Lab ca2dd04, t83 teste 1: o detalhe do contrato rolava 38 px para o lado a 360 px. O campo nativo de arquivo
// tem largura própria e, dentro de um grid sem coluna definida, empurra o cartão para fora da tela.
const fonte = readFileSync("src/components/contrato/conferencia-contrato.tsx", "utf8");

test("campos de arquivo da conferência não passam da largura do cartão (360 px)", () => {
  const campos = fonte.match(/<input type="file".*?\/>/g) ?? [];
  assert.equal(campos.length, 2);
  for (const campo of campos) assert.match(campo, /className="[^"]*\bw-full\b[^"]*\bmax-w-full\b/);
});

test("formulário de item da conferência tem uma única coluna que pode encolher", () => {
  assert.match(fonte, /className="mt-4 grid grid-cols-1 gap-2"/);
});
