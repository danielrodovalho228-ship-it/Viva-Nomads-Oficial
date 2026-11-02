/* Roda: node --test src/components/anuncio/contadores-passo6.test.ts — conformidade do cadastro (Passo 6, 01/11): os
   contadores de caracteres da mesma tela no mesmo formato "N/MÁX" ("Outras regras" dizia "0 de 280 caracteres" ao lado
   de "0/500" da mensagem para quem pede e do "N/140" das condições de pets). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("os três contadores do Passo 6 usam N/MÁX", () => {
  assert.match(ler("./regras-casa-campos.tsx"), /\{value\.outras\.length\}\/\{MAX_OUTRAS_REGRAS\}/);
  assert.doesNotMatch(ler("./regras-casa-campos.tsx"), /\} de \{MAX_OUTRAS_REGRAS\} caracteres/);
  assert.match(ler("./chegada-e-pedido-campos.tsx"), /\{value\.mensagemParaPedido\.length\}\/\{LIMITE_MENSAGEM_PEDIDO\}/);
  assert.match(ler("./pets-regras-campos.tsx"), /\{value\.observacao\.length\}\/\{MAX_OBSERVACAO_PET\}/);
});
