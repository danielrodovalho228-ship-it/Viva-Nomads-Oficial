/* Roda: node --test "src/app/(dashboard)/dashboard/imoveis/novo/passo4-mockup.test.ts" — conformidade do cadastro
   (Passo 4, mockup cadastro-imovel-04, 01/11): o cartão dos números tem o título "Características do imóvel" e, abaixo,
   o lembrete "Você pode revisar e editar depois, a qualquer momento." */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./etapa-encontramos.tsx", import.meta.url), "utf8");

test("título e lembrete do mockup 04", () => {
  assert.match(src, /export const TITULO_CARACTERISTICAS = "Características do imóvel";/);
  assert.match(src, /export const ESPACO_EDITAR_DEPOIS = "Você pode revisar e editar depois, a qualquer momento\.";/);
  const espaco = src.slice(src.indexOf('if (p.parte === "espaco")'), src.indexOf("E111-A"));
  assert.ok(espaco.indexOf("{TITULO_CARACTERISTICAS}") < espaco.indexOf('data-testid="cartao-numeros"'));
  assert.ok(espaco.indexOf('data-testid="cartao-numeros"') < espaco.indexOf('data-testid="espaco-editar-depois"'));
});
