/*
  Ordem 02d4c903, F42: o Fechamento é do PROPRIETÁRIO (OWNER_ONLY), então a tela não pode falar
  com o inquilino em segunda pessoa ("Como você quer pagar?", "Quanto você paga"…).
  Roda: node --test src/lib/fechamento-voz-dono.test.ts
*/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ARQ = "src/app/(dashboard)/dashboard/fechamento/closing-flow.tsx";
const f = readFileSync(ARQ, "utf8");

test("F42: textos do inquilino em 2ª pessoa não aparecem no Fechamento do proprietário", () => {
  for (const frase of [
    "Como você quer pagar?",
    "Por quanto tempo você quer ficar?",
    "Para começar você paga só",
    "Quanto você paga",
    "Volta para você?",
    "Se você quebrar algo",
    "sempre com seu aceite",
  ]) {
    assert.ok(!f.includes(frase), `ainda tem: ${frase}`);
  }
});

test("F42: os equivalentes neutros existem", () => {
  for (const frase of [
    "Como o inquilino vai pagar a caução?",
    "Por quanto tempo será a estadia?",
    "Quanto o inquilino paga",
    "Volta para o inquilino?",
    "Se o inquilino quebrar algo",
  ]) {
    assert.ok(f.includes(frase), `falta: ${frase}`);
  }
});

test("achado #596: dano em voz neutra e taxa lida da constante única (F35)", () => {
  assert.ok(!f.includes("você responde pelos danos"));
  assert.ok(f.includes("o inquilino responde pelos danos que causar"));
  assert.ok(!f.includes("A comissão é cobrada"));
  assert.ok(f.includes("{TEXTO_RENOVACAO_COMISSAO}"));
});
