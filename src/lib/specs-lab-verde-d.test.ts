/*
  Estático (laboratório verde, faixa D, lab bcb8d37c): três specs que falhavam por causa do próprio spec.
  - t6: a taxa do contrato hoje aparece como "12% sobre o valor mensal × meses (…)" (rotuloBaseTaxa), não "do valor total".
  - t129: os dois tamanhos de tela mexem na MESMA conta; em paralelo um restaurava o motivo enquanto o outro lia.
  - t91: a resposta entra na página do anúncio só após o cache de 60 s; a espera tem de caber folgada nisso.
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const raiz = new URL("../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(join(raiz, p), "utf8");

test("t6 aceita o rótulo atual da taxa (valor mensal × meses)", () => {
  const spec = ler("tests/e2e/specs/t6-dinheiro-numeros.spec.ts");
  const base = ler("src/lib/taxa-servico-base.ts");
  assert.match(base, /sobre o valor mensal × meses/);
  assert.match(spec, /sobre o valor mensal × meses/);
});

test("t129 roda em série (mesma conta nos dois tamanhos de tela)", () => {
  const spec = ler("tests/e2e/specs/t129-motivo-estadia-perfil.spec.ts");
  assert.match(spec, /test\.describe\.configure\(\{\s*mode:\s*"serial"\s*\}\)/);
});

test("t91 espera a resposta além do cache de 60 s", () => {
  const spec = ler("tests/e2e/specs/t91-avaliacao-resposta.spec.ts");
  const m = spec.match(/\.toPass\(\{[^}]*timeout:\s*([\d_]+)/);
  assert.ok(m, "toPass com timeout");
  assert.ok(Number(m[1].replace(/_/g, "")) >= 110_000);
});
