/*
  Estático (laboratório verde, faixa D): todo data-testid que a spec t37 usa tem de existir no código.
  O t37 esperava o bloco "plano-gestor" e a tabela a 390 px; o produto passou a ter botão + cartões (t185) e a spec
  só quebrava no laboratório. Roda: node --experimental-strip-types --test src/lib/spec-t37-testids.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const raiz = new URL("../../", import.meta.url).pathname;
const spec = readFileSync(join(raiz, "tests/e2e/specs/t37-simuladores-e-numeros.spec.ts"), "utf8");

function fontes(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) fontes(p, acc);
    else if (/\.(tsx|ts)$/.test(nome) && !/\.test\./.test(nome)) acc.push(p);
  }
  return acc;
}

test("t37: cada getByTestId(\"...\") da spec existe como data-testid em src/", () => {
  const ids = [...spec.matchAll(/getByTestId\("([^"$]+)"\)/g)].map((m) => m[1]);
  assert.ok(ids.length >= 4);
  const codigo = fontes(join(raiz, "src")).map((p) => readFileSync(p, "utf8")).join("\n");
  const faltando = [...new Set(ids)].filter((id) => !codigo.includes(`data-testid="${id}"`) && !codigo.includes(`"${id}"`));
  assert.deepEqual(faltando, []);
});

test("t37: /precos tem tabela (≥640 px) e cartões (celular) das faixas, e a spec cobre os dois", () => {
  const pagina = readFileSync(join(raiz, "src/app/(public)/precos/page.tsx"), "utf8");
  assert.match(pagina, /data-testid="faixas-taxa"/);
  assert.match(pagina, /data-testid="faixas-taxa-cartoes"/);
  assert.match(spec, /width: 390/);
  assert.match(spec, /width: 1280/);
  assert.match(spec, /faixas-taxa-cartoes/);
});
