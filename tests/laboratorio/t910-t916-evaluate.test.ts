import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// E744: duas quebras de código de spec (não do produto): closure que não atravessa o evaluate (t916) e nó de texto fora dos filhos diretos (t910).
test("t916 passa o rótulo como argumento do evaluateAll", () => {
  const s = readFileSync("tests/e2e/specs/t916-buscas-salvas-uma-barra.spec.ts", "utf8");
  assert.doesNotMatch(s, /evaluateAll\(visiveis\(/);
  assert.match(s, /evaluateAll\(contaVisiveis, "Buscas salvas"\)/);
  assert.match(s, /\(els: Element\[\], rotulo: string\)/);
});
test("t910 procura o nó de texto do botão em qualquer profundidade", () => {
  const s = readFileSync("tests/e2e/specs/t910-e617-caucao-passo8.spec.ts", "utf8");
  assert.match(s, /createTreeWalker\(el, NodeFilter\.SHOW_TEXT\)/);
  assert.doesNotMatch(s, /\[\.\.\.el\.childNodes\]\.find/);
});
