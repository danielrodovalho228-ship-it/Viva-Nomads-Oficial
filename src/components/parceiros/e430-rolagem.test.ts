/*
  E430 (D-V12, lab 02/11): /parceiros rolava 10–16 px para o lado a 390 px para quem já tem pedido de parceria. Causa:
  "Mandamos a confirmação para {e-mail}" — o e-mail da conta é uma "palavra" longa sem espaço, que alargava o cartão
  do formulário (e a coluna da grade). Agora o texto quebra o e-mail (overflow-wrap: anywhere); o mesmo no aviso
  "Confirme o seu e-mail (…)".
  Roda: npm test
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const f = readFileSync(new URL("./seja-parceiro-form.tsx", import.meta.url), "utf8");

test("os textos com o e-mail da conta quebram o e-mail", () => {
  assert.match(f, /<p className="mt-1 text-sm text-muted \[overflow-wrap:anywhere\]" data-testid="seja-parceiro-confirmacao">Mandamos a confirmação para \{estado\.email\}/);
  assert.match(f, /text-sm text-ink \[overflow-wrap:anywhere\]" role="alert" data-testid="seja-parceiro-confirmar-email"/);
});
