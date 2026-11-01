/* Roda: node --test "src/app/(public)/excluir-conta/campo-email.test.ts" — varredura 01/11 (Pista A): em /excluir-conta o
   campo de e-mail tinha 20–23 px de altura dentro de uma caixa de 44 px (tocar na borda da caixa não focava) e 14 px de
   fonte (zoom no iPhone). Agora ocupa a caixa (min-h-12), 16 px no celular, e o erro é anunciado e ligado ao campo. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const form = readFileSync(new URL("./form.tsx", import.meta.url), "utf8");

test("campo de e-mail ocupa a caixa inteira e usa 16 px no celular", () => {
  assert.match(form, /className="min-h-12 w-full bg-transparent text-base outline-none placeholder:text-muted sm:text-sm"/);
  assert.doesNotMatch(form, /px-4 py-3 focus-within/);
});

test("o erro é anunciado e ligado ao campo", () => {
  assert.match(form, /aria-describedby=\{erro \? "email-exclusao-erro" : undefined\}/);
  assert.match(form, /id="email-exclusao-erro" role="alert"/);
  assert.match(form, /aria-invalid=\{erro \? true : undefined\}/);
});
