import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CARTOES_SECAO } from "../../src/lib/cartoes-secao.ts";

// E744: a t710 confere as fotos que /empresas realmente renderiza (pilares da página), nem mais nem menos.
test("t710: os alts esperados de /empresas são os dos pilares que a página usa", () => {
  const page = readFileSync("src/app/(public)/empresas/page.tsx", "utf8");
  const pilares = page.slice(page.indexOf("const PILARES"), page.indexOf("];", page.indexOf("const PILARES")));
  const ids = [...pilares.matchAll(/id:\s*"([a-z]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length >= 2);
  const alts = ids.map((id) => CARTOES_SECAO.find((c) => c.pagina === "empresas" && c.id === id)!.alt);
  const spec = readFileSync("tests/e2e/specs/t710-e265-sem-selo-em-todo-cartao.spec.ts", "utf8");
  const bloco = spec.slice(spec.indexOf('"/empresas": ['), spec.indexOf('"/para-proprietarios": ['));
  for (const a of alts) assert.ok(bloco.includes(a), a);
  const naSpec = [...bloco.matchAll(/^\s+"([^"]+)",$/gm)].map((m) => m[1]);
  assert.deepEqual(naSpec, alts);
});
