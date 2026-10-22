/* Roda: node --test src/lib/dv-buscar-fotos-cartao.test.ts — D-V: o carrossel do cartão só põe na página a foto visível e a próxima (t249, /buscar). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const fotos = readFileSync(join("src", "components/property/fotos-cartao.tsx"), "utf8");

test("carrossel do cartão: além da próxima foto, só um espaço do mesmo tamanho (sem <img>)", () => {
  assert.match(fotos, /i > ativo \+ 1 \? \(\s*<div key=\{`\$\{src\}-\$\{i\}`\} aria-hidden className="h-full w-full shrink-0 snap-start bg-surface-2" data-foto-depois="" \/>/);
  assert.match(fotos, /setAtivo\(Math\.round\(el\.scrollLeft \/ Math\.max\(1, el\.clientWidth\)\)\)/);
  assert.match(fotos, /MAX_FOTOS_CARTAO = 5/);
});
