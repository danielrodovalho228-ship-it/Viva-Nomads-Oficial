/*
  Erros/estados vazios (rodada 9) — contador de imóveis do pedido: falha de LEITURA não vira "0 combinam" nem conta
  imóvel ocupado como livre; devolve null (a tela some com a contagem). Roda: node --test src/lib/data/e293-leituras-contador.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const s = readFileSync(new URL("../../../src/lib/data/pedido-contador-actions.ts", import.meta.url), "utf8");

test("as 3 leituras auxiliares (documento, bloqueios, blocos de contrato) checam error e devolvem null", () => {
  assert.match(s, /const \{ data: checks, error: erroChecks \} = await admin/);
  assert.match(s, /if \(erroChecks\) return null;/);
  assert.match(s, /const \{ data: bloqueios, error: erroBloqueios \} = await admin/);
  assert.match(s, /if \(erroBloqueios\) return null;/);
  assert.match(s, /const \{ data: blocos, error: erroBlocos \} = await admin/);
  assert.match(s, /if \(erroBlocos\) return null;/);
});

test("a checagem de erro vem antes do uso do resultado", () => {
  assert.ok(s.indexOf("if (erroChecks) return null;") < s.indexOf("const aprovado"));
  assert.ok(s.indexOf("if (erroBloqueios) return null;") < s.indexOf("for (const b of (bloqueios"));
  assert.ok(s.indexOf("if (erroBlocos) return null;") < s.indexOf("for (const b of (blocos"));
});
