import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// E744 (t352): a varredura refaz a leitura quando a página navega no meio dela.
const fonte = readFileSync("tests/e2e/fixtures/varredura-pagina.ts", "utf8");
test("varrerPagina tenta até 3 vezes só para 'Execution context was destroyed'", () => {
  assert.match(fonte, /export async function varrerPagina\(page: Page, respostasRuins: string\[\]\): Promise<Achados> \{\s*\n\s*for \(let tentativa = 1; ; tentativa\+\+\)/);
  assert.match(fonte, /tentativa >= 3 \|\| !CONTEXTO_DESTRUIDO\.test\(String\(e\)\)\) throw e/);
  assert.match(fonte, /async function varrerPaginaUmaVez/);
});
test("o padrão reconhece o erro real do lab e não engole os outros", async () => {
  const re = /Execution context was destroyed|Target page, context or browser has been closed|Frame was detached/;
  assert.ok(re.test("Error: page.evaluate: Execution context was destroyed, most likely because of a navigation."));
  assert.ok(!re.test("Error: expect(received).toEqual(expected)"));
});
