import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Lab 70f874c: t102 estourava 45 s porque /Continuar|Retomar/ casava com o "Continuar" do rodapé do cadastro.
test("t102: o botão de retomar rascunho é buscado dentro do aviso, não por regex solta", () => {
  const spec = readFileSync("tests/e2e/specs/t102-preco-sugerido.spec.ts", "utf8");
  assert.ok(!/name:\s*\/Continuar\|Retomar\//.test(spec));
  assert.match(spec, /Você tem um anúncio em andamento/);
});
