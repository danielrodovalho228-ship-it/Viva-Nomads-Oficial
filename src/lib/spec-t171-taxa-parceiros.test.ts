/*
  Estático (laboratório verde, faixa D): a spec t171 testa a taxa única de 10% dos parceiros, não as faixas
  R$ 40/60/80 que saíram no Prompt 29 (commit 394fac1b). Antes, ela esperava getByTestId("faixas-taxa-parceria") e
  falhava 4 vezes na main. Roda: node --experimental-strip-types --test src/lib/spec-t171-taxa-parceiros.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const raiz = new URL("../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(join(raiz, p), "utf8");
const spec = ler("tests/e2e/specs/t171-faixas-taxa-cors.spec.ts");
const PAGINAS = ["src/app/(public)/parceiros/page.tsx", "src/app/(public)/parceiros/fotografos/page.tsx"];

test("t171: as duas páginas públicas têm o data-testid que a spec lê e não têm mais as faixas antigas", () => {
  for (const p of PAGINAS) {
    const codigo = ler(p);
    assert.match(codigo, /data-testid="taxa-servico-parceiros"/, p);
    assert.doesNotMatch(codigo, /faixas-taxa-parceria/, p);
  }
});

test("t171: a spec confere a taxa de 10% e exige que as faixas antigas não voltem", () => {
  assert.match(spec, /getByTestId\("taxa-servico-parceiros"\)/);
  assert.match(spec, /10% sobre o valor do serviço/);
  assert.match(spec, /getByTestId\("faixas-taxa-parceria"\)\)\.toHaveCount\(0\)/);
  assert.doesNotMatch(spec, /toContainText\("R\$ (40|60|80)"\)/);
  assert.match(spec, /width: 360/);
  assert.match(spec, /width: 1280/);
});
