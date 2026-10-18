/*
  Estático: depois que a assinatura é aceita pelo servidor, o formulário some na hora e a tela recarrega (lab t205).
  Roda: node --experimental-strip-types --test src/lib/assinar-contrato-some.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const form = readFileSync(new URL("../components/contrato/assinar-contrato.tsx", import.meta.url), "utf8");

test("assinar contrato: após o sucesso esconde o formulário e chama router.refresh()", () => {
  assert.match(form, /setAssinado\(true\);[\s\S]*router\.refresh\(\)/);
  assert.match(form, /if \(assinado\) return null/);
});
